// =============================================================================
// INDEX DSaaS — Compliance Dashboard REST API Server
// Express HTTP server that powers the web/ dashboard
// Runs on :3001 independently from the MCP server (src/index.ts)
// =============================================================================

import express from "express";
import {
  readFileSync, writeFileSync, existsSync,
  mkdirSync, readdirSync, unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GraphClient } from "./services/graph-client.js";
import { assessControl } from "./services/compliance-engine.js";
import { generateWordReport } from "./services/report-generator.js";
import {
  listClients, getClient, getDefaultClient,
  addClient, updateClient, deleteClient,
  maskSecret, upsertByTenantId,
} from "./services/client-manager.js";
import {
  getFrameworkControls,
  getFramework,
  listFrameworks,
} from "./data/framework-registry.js";
import {
  DIBCAC_OBJECTIVES,
  getObjectivesForControl,
  type DIBCACObjective,
} from "./data/dibcac-objectives.js";
import type {
  ComplianceReport,
  ComplianceSummary,
  ControlAssessment,
  Client,
  ObjectiveStatus,
  ObjectiveStatusValue,
  ObjectiveEvidenceSource,
  DIBCACObjectiveSummary,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Paths relative to dist/api-server.js  →  ../web/
const WEB_DIR     = join(__dirname, "..", "web");
const CONFIG_DIR  = join(WEB_DIR, ".config");
const REPORTS_DIR = join(WEB_DIR, ".reports");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Report persistence ────────────────────────────────────────────────────

function saveReport(report: ComplianceReport) {
  ensureDir(REPORTS_DIR);
  writeFileSync(
    join(REPORTS_DIR, `${report.reportId}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );
}

function loadReport(reportId: string): ComplianceReport | null {
  try {
    const f = join(REPORTS_DIR, `${reportId}.json`);
    if (!existsSync(f)) return null;
    return JSON.parse(readFileSync(f, "utf8")) as ComplianceReport;
  } catch { return null; }
}

function listReportMetas() {
  try {
    ensureDir(REPORTS_DIR);
    return readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        try {
          const r = JSON.parse(readFileSync(join(REPORTS_DIR, f), "utf8")) as ComplianceReport;
          return {
            reportId:           r.reportId,
            frameworkId:        r.frameworkId,
            frameworkName:      r.frameworkName,
            tenantDisplayName:  r.tenantDisplayName,
            generatedAt:        r.generatedAt,
            summary:            r.summary,
            clientId:           r.clientId,
            clientName:         r.clientName,
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) =>
        new Date((b as any).generatedAt).getTime() -
        new Date((a as any).generatedAt).getTime()
      );
  } catch { return []; }
}

// ─── Summary builder ───────────────────────────────────────────────────────

function buildSummary(assessments: ControlAssessment[]): ComplianceSummary {
  const total         = assessments.length;
  const passed        = assessments.filter(a => a.status === "pass").length;
  const failed        = assessments.filter(a => a.status === "fail").length;
  const partial       = assessments.filter(a => a.status === "partial").length;
  const notAssessed   = assessments.filter(a => a.status === "not_assessed").length;
  const notApplicable = assessments.filter(a => a.status === "not_applicable").length;
  const assessable    = total - notApplicable - notAssessed;
  const compliancePercentage = assessable > 0
    ? Math.round(((passed + partial * 0.5) / assessable) * 100)
    : 0;

  let riskScore: ComplianceSummary["riskScore"] = "critical";
  if (compliancePercentage >= 90)      riskScore = "low";
  else if (compliancePercentage >= 70) riskScore = "medium";
  else if (compliancePercentage >= 50) riskScore = "high";

  return {
    totalControls: total,
    passed,
    failed,
    partial,
    notAssessed,
    notApplicable,
    compliancePercentage,
    riskScore,
    topFindings: assessments
      .filter(a => a.status === "fail")
      .flatMap(a => a.findings)
      .slice(0, 5),
  };
}

// ─── Client → GraphClient factory ─────────────────────────────────────────

function makeGraphClient(client: Client): GraphClient {
  return new GraphClient({
    tenantId:     client.tenantId,
    clientId:     client.clientId,
    clientSecret: client.clientSecret,
    scopes:       ["https://graph.microsoft.com/.default"],
  });
}

// ─── Resolve client for a request ─────────────────────────────────────────
// Uses ?clientId query param if provided, otherwise the first configured client.

function resolveClient(clientIdParam?: string): Client | null {
  if (clientIdParam) return getClient(clientIdParam);
  return getDefaultClient();
}

// ─── Express app ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Allow the Next.js dashboard (port 3000) to call the API directly
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ── Health ─────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  const clients = listClients();
  const primary = clients[0];
  res.json({ ok: true, configured: clients.length > 0, tenantName: primary?.name ?? null });
});

// ── Config: status (backward compat — derives from clients list) ───────────

app.get("/api/config/status", (_req, res) => {
  const clients = listClients();
  if (clients.length === 0) return void res.json({ configured: false });
  const primary = clients[0];
  res.json({
    configured:          true,
    tenantId:            primary.tenantId,
    tenantName:          primary.name,
    clientCount:         clients.length,
    // Anthropic key is now server infrastructure — no longer user-configured
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ── Config: save (setup wizard — upserts by tenantId) ─────────────────────

app.post("/api/config", (req, res) => {
  const { tenantId, clientId, clientSecret, tenantName } = req.body as {
    tenantId?: string; clientId?: string; clientSecret?: string; tenantName?: string;
  };
  if (!tenantId || !clientId || !clientSecret)
    return void res.status(400).json({ error: "tenantId, clientId, and clientSecret are required" });

  const client = upsertByTenantId({
    tenantId,
    clientId,
    clientSecret,
    name: tenantName ?? `Tenant ${tenantId.slice(0, 8)}`,
  });
  res.json({ ok: true, clientId: client.id });
});

// ── Config: test credentials (body or first stored client) ────────────────

app.post("/api/config/test", async (req, res) => {
  const body = req.body as Partial<{ tenantId: string; clientId: string; clientSecret: string }>;

  let testClient: Client | null = null;
  if (body.tenantId && body.clientId && body.clientSecret) {
    testClient = {
      id: "test", name: "test",
      tenantId: body.tenantId,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      addedAt: new Date().toISOString(),
    };
  } else {
    testClient = getDefaultClient();
  }
  if (!testClient) return void res.status(400).json({ error: "No credentials to test" });

  const graphClient = makeGraphClient(testClient);

  const probes: { path: string; extract: (d: any) => { name?: string; domain?: string } }[] = [
    {
      path: "/organization",
      extract: (d) => {
        const o = d.value?.[0];
        return { name: o?.displayName, domain: o?.verifiedDomains?.find((v: any) => v.isDefault)?.name };
      },
    },
    {
      path: "/users?$top=1&$select=id,userPrincipalName",
      extract: (d) => ({ domain: d.value?.[0]?.userPrincipalName?.split("@")[1] }),
    },
    { path: "/auditLogs/signIns?$top=1&$select=id",                extract: () => ({}) },
    { path: "/policies/conditionalAccessPolicies?$top=1&$select=id", extract: () => ({}) },
  ];

  let tenantName: string | undefined;
  let domain: string | undefined;

  for (const probe of probes) {
    try {
      const data = await graphClient.rawQuery(probe.path);
      const extracted = probe.extract(data);
      tenantName = tenantName ?? extracted.name;
      domain     = domain     ?? extracted.domain;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("AADSTS") || msg.includes("invalid_client")) {
        return void res.status(401).json({ ok: false, error: `Authentication failed: ${msg}` });
      }
    }
  }

  const displayName = tenantName ?? (domain ? `Tenant (${domain})` : `Tenant ${testClient.tenantId}`);
  res.json({ ok: true, tenantName: displayName, domain: domain ?? "" });
});

// ── Clients: list ──────────────────────────────────────────────────────────

app.get("/api/clients", (_req, res) => {
  res.json(listClients().map(maskSecret));
});

// ── Clients: add ──────────────────────────────────────────────────────────

app.post("/api/clients", (req, res) => {
  const { name, tenantId, clientId, clientSecret } = req.body as Partial<Client>;
  if (!name || !tenantId || !clientId || !clientSecret)
    return void res.status(400).json({ error: "name, tenantId, clientId, and clientSecret are required" });

  const client = addClient({ name, tenantId, clientId, clientSecret });
  res.status(201).json(maskSecret(client));
});

// ── Clients: update ───────────────────────────────────────────────────────

app.put("/api/clients/:id", (req, res) => {
  const { name, tenantId, clientId, clientSecret } = req.body as Partial<Client>;
  // Only update secret if a non-empty value was supplied
  const patch: Partial<Omit<Client, "id" | "addedAt">> = {};
  if (name)         patch.name         = name;
  if (tenantId)     patch.tenantId     = tenantId;
  if (clientId)     patch.clientId     = clientId;
  if (clientSecret) patch.clientSecret = clientSecret;

  const updated = updateClient(req.params.id, patch);
  if (!updated) return void res.status(404).json({ error: "Client not found" });
  res.json(maskSecret(updated));
});

// ── Clients: delete ───────────────────────────────────────────────────────

app.delete("/api/clients/:id", (req, res) => {
  const ok = deleteClient(req.params.id);
  if (!ok) return void res.status(404).json({ error: "Client not found" });
  res.json({ ok: true });
});

// ── Clients: test connection ───────────────────────────────────────────────

app.post("/api/clients/:id/test", async (req, res) => {
  const client = getClient(req.params.id);
  if (!client) return void res.status(404).json({ error: "Client not found" });

  const graphClient = makeGraphClient(client);
  try {
    // Try a minimal call to validate credentials
    await graphClient.rawQuery("/organization?$select=id,displayName");
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(200).json({ ok: false, error: msg });
  }
});

// ── Frameworks: list ───────────────────────────────────────────────────────

app.get("/api/frameworks", (_req, res) => {
  res.json(listFrameworks().map(f => ({
    id:           f.id,
    name:         f.name,
    version:      f.version,
    description:  f.description,
    controlCount: f.controls.length,
    implemented:  f.controls.length > 0,
  })));
});

app.get("/api/frameworks/:id", (req, res) => {
  const fw = getFramework(req.params.id as any);
  if (!fw) return void res.status(404).json({ error: "Not found" });
  res.json({ id: fw.id, name: fw.name, version: fw.version, description: fw.description, controlCount: fw.controls.length, implemented: fw.controls.length > 0 });
});

app.get("/api/frameworks/:id/controls", (req, res) => {
  const controls = getFrameworkControls(req.params.id as any);
  res.json(controls.map(c => ({
    controlId:           c.controlId,
    title:               c.title,
    description:         c.description,
    family:              c.family,
    evidenceQueryCount:  c.evidenceQueries.length,
    requiredPermissions: [...new Set(c.evidenceQueries.flatMap(q => q.requiredPermissions))],
  })));
});

// ─── SSE: full framework assessment stream ─────────────────────────────────
// GET /api/assess/stream/:frameworkId?clientId=xxx
// clientId is optional — defaults to first configured client

app.get("/api/assess/stream/:frameworkId", async (req, res) => {
  const client = resolveClient(req.query.clientId as string | undefined);
  if (!client) {
    res.status(401).json({ error: "No clients configured. Add a client first." });
    return;
  }

  const fw       = getFramework(req.params.frameworkId as any);
  const controls = getFrameworkControls(req.params.frameworkId as any);
  if (!fw || controls.length === 0) {
    res.status(404).json({ error: "Framework not found or not yet implemented" });
    return;
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const graphClient = makeGraphClient(client);

  send({ type: "start", frameworkId: fw.id, frameworkName: fw.name, total: controls.length });

  const assessments: ControlAssessment[] = [];

  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    send({ type: "progress", controlId: c.controlId, title: c.title, index: i + 1, total: controls.length });

    try {
      const a = await assessControl(c, graphClient);
      assessments.push(a);
      send({ type: "result", assessment: a });
    } catch (err) {
      const a: ControlAssessment = {
        controlId:         c.controlId,
        controlTitle:      c.title,
        frameworkId:       c.frameworkId,
        family:            c.family,
        status:            "not_assessed",
        evidenceCollected: [],
        findings:          [`Assessment error: ${err instanceof Error ? err.message : String(err)}`],
        recommendations:   [],
        assessedAt:        new Date().toISOString(),
      };
      assessments.push(a);
      send({ type: "result", assessment: a });
    }
  }

  const report: ComplianceReport = {
    reportId:           `RPT-${Date.now()}`,
    tenantId:           client.tenantId,
    tenantDisplayName:  client.name,
    frameworkId:        fw.id,
    frameworkName:      fw.name,
    generatedAt:        new Date().toISOString(),
    generatedBy:        "INDEX Compliance Assessment Engine v1.0",
    summary:            buildSummary(assessments),
    controlAssessments: assessments,
    clientId:           client.id,
    clientName:         client.name,
  };

  saveReport(report);

  // Auto-initialize DIBCAC 320 objectives for CMMC L2 assessments
  if (report.frameworkId === "CMMC_L2") {
    const objStatuses = initObjectivesFromReport(report);
    saveObjectives(report.reportId, objStatuses);
    const objSummary = buildObjectiveSummary(objStatuses);
    send({ type: "objectives_initialized", reportId: report.reportId, summary: objSummary });
  }

  send({ type: "complete", report });
  res.end();
});

// ── Assess: single control ─────────────────────────────────────────────────

app.post("/api/assess/:frameworkId/control/:controlId", async (req, res) => {
  const client = resolveClient(req.query.clientId as string | undefined);
  if (!client) return void res.status(401).json({ error: "No clients configured" });

  const controls = getFrameworkControls(req.params.frameworkId as any);
  const control  = controls.find(c => c.controlId === req.params.controlId);
  if (!control) return void res.status(404).json({ error: "Control not found" });

  try {
    const graphClient = makeGraphClient(client);
    res.json(await assessControl(control, graphClient));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Reports: list / get / delete ───────────────────────────────────────────

app.get("/api/reports", (_req, res) => res.json(listReportMetas()));

app.get("/api/reports/:id", (req, res) => {
  const r = loadReport(req.params.id);
  if (!r) return void res.status(404).json({ error: "Not found" });
  res.json(r);
});

app.delete("/api/reports/:id", (req, res) => {
  const f = join(REPORTS_DIR, `${req.params.id}.json`);
  if (!existsSync(f)) return void res.status(404).json({ error: "Not found" });
  unlinkSync(f);
  res.json({ ok: true });
});

// ─── Resolve Anthropic API key ────────────────────────────────────────────
// Primary: ANTHROPIC_API_KEY env var (deployment-level config, no user UI needed)
// Fallback: legacy credentials.json anthropicApiKey (backward compat during transition)

function resolveAnthropicKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const legacyPath = join(CONFIG_DIR, "credentials.json");
    if (existsSync(legacyPath)) {
      const creds = JSON.parse(readFileSync(legacyPath, "utf8"));
      if (creds.anthropicApiKey) return creds.anthropicApiKey as string;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Reports: export as Word document ───────────────────────────────────────
// GET /api/reports/:id/export/word
// Anthropic API key is baked into server infrastructure — no user config needed.

app.get("/api/reports/:id/export/word", async (req, res) => {
  const report = loadReport(req.params.id);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  const apiKey = resolveAnthropicKey();
  if (!apiKey) {
    return void res.status(500).json({
      error: "Anthropic API key is not configured on this server. Set ANTHROPIC_API_KEY in the environment.",
      code:  "ANTHROPIC_KEY_MISSING",
    });
  }

  try {
    const safeFramework = report.frameworkName.replace(/[^a-z0-9]/gi, "_");
    const safeTenant    = report.tenantDisplayName.replace(/[^a-z0-9]/gi, "_");
    const filename      = `${safeFramework}_${safeTenant}_${report.reportId}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const buffer = await generateWordReport(report, apiKey, (msg) => {
      console.log(`[Word Export] ${req.params.id}: ${msg}`);
    });

    res.end(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Word Export] Error:", message);
    if (!res.headersSent) {
      res.status(500).json({ error: `Word generation failed: ${message}` });
    }
  }
});

// =============================================================================
// DIBCAC 320 Objective Tracking
// =============================================================================

const OBJECTIVES_DIR = join(WEB_DIR, ".objectives");

function objectivesPath(reportId: string) {
  ensureDir(OBJECTIVES_DIR);
  return join(OBJECTIVES_DIR, `${reportId}.json`);
}

function loadObjectives(reportId: string): ObjectiveStatus[] {
  try {
    const f = objectivesPath(reportId);
    if (!existsSync(f)) return [];
    return JSON.parse(readFileSync(f, "utf8")) as ObjectiveStatus[];
  } catch { return []; }
}

function saveObjectives(reportId: string, statuses: ObjectiveStatus[]) {
  writeFileSync(objectivesPath(reportId), JSON.stringify(statuses, null, 2), "utf8");
}

/**
 * Auto-initialize objective statuses for a newly completed assessment.
 * Only runs for CMMC_L2 reports (which have DIBCAC objectives).
 */
function initObjectivesFromReport(report: ComplianceReport): ObjectiveStatus[] {
  if (report.frameworkId !== "CMMC_L2") return [];

  // Build a lookup of controlId → assessment status
  const statusByControl = new Map<string, ControlAssessment>();
  for (const a of report.controlAssessments) {
    statusByControl.set(a.controlId, a);
  }

  const now = new Date().toISOString();

  return DIBCAC_OBJECTIVES.map((obj: DIBCACObjective): ObjectiveStatus => {
    const parentAssessment = statusByControl.get(obj.controlId);

    // Physical Review — always flagged; no automation possible
    if (obj.automation === "physical") {
      return {
        objectiveId:   obj.objectiveId,
        status:        "requires_physical",
        evidenceSource: "none",
        assessedAt:    now,
        assessedBy:    "automated",
      };
    }

    // Document objectives — always need manual attestation
    if (obj.automation === "manual") {
      return {
        objectiveId:   obj.objectiveId,
        status:        "requires_manual",
        evidenceSource: "none",
        assessedAt:    now,
        assessedBy:    "automated",
      };
    }

    // No parent assessment — not assessed
    if (!parentAssessment) {
      return {
        objectiveId:   obj.objectiveId,
        status:        "not_assessed",
        evidenceSource: "none",
        assessedAt:    now,
        assessedBy:    "automated",
      };
    }

    // Automated (Screen Share in Graph-verifiable domains) → inherit control status
    if (obj.automation === "automated") {
      const source: ObjectiveEvidenceSource = "automated_graph";
      const controlStatus = parentAssessment.status;
      let status: ObjectiveStatusValue;
      if (controlStatus === "pass")           status = "met";
      else if (controlStatus === "partial")   status = "partially_met";
      else if (controlStatus === "fail")      status = "not_met";
      else                                    status = "not_assessed";
      return { objectiveId: obj.objectiveId, status, evidenceSource: source, assessedAt: now, assessedBy: "automated" };
    }

    // Semi-automated (Artifact in supported domains) — inherit as partial evidence
    if (obj.automation === "semi-automated") {
      const controlStatus = parentAssessment.status;
      const source: ObjectiveEvidenceSource = "inherited_from_control";
      let status: ObjectiveStatusValue;
      if (controlStatus === "pass")           status = "met";
      else if (controlStatus === "partial")   status = "partially_met";
      else if (controlStatus === "fail")      status = "requires_manual";
      else                                    status = "requires_manual";
      return { objectiveId: obj.objectiveId, status, evidenceSource: source, assessedAt: now, assessedBy: "automated" };
    }

    return { objectiveId: obj.objectiveId, status: "not_assessed", evidenceSource: "none", assessedAt: now, assessedBy: "automated" };
  });
}

function buildObjectiveSummary(statuses: ObjectiveStatus[]): DIBCACObjectiveSummary {
  const total          = statuses.length;
  const met            = statuses.filter(s => s.status === "met").length;
  const partiallyMet   = statuses.filter(s => s.status === "partially_met").length;
  const notMet         = statuses.filter(s => s.status === "not_met").length;
  const requiresManual = statuses.filter(s => s.status === "requires_manual").length;
  const requiresPhys   = statuses.filter(s => s.status === "requires_physical").length;
  const notAssessed    = statuses.filter(s => s.status === "not_assessed").length;

  // Coverage: out of non-physical objectives
  const nonPhysical = total - requiresPhys;
  const coveragePercentage = nonPhysical > 0
    ? Math.round(((met + partiallyMet * 0.5) / nonPhysical) * 100)
    : 0;

  return { total, met, partiallyMet, notMet, requiresManual, requiresPhysical: requiresPhys, notAssessed, coveragePercentage };
}

// ── DIBCAC Objectives: list all definitions ────────────────────────────────

app.get("/api/objectives", (_req, res) => {
  // Return full objective list grouped by domain, with stats
  const byDomain = DIBCAC_OBJECTIVES.reduce<Record<string, DIBCACObjective[]>>((acc, o) => {
    (acc[o.domain] ??= []).push(o);
    return acc;
  }, {});
  res.json({
    total:    DIBCAC_OBJECTIVES.length,
    byDomain,
    objectives: DIBCAC_OBJECTIVES,
  });
});

// ── DIBCAC Objectives: status for a report ─────────────────────────────────

app.get("/api/reports/:id/objectives", (req, res) => {
  const report = loadReport(req.params.id);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  let statuses = loadObjectives(req.params.id);

  // Auto-initialize if not yet done (e.g. reports created before this feature)
  if (statuses.length === 0 && report.frameworkId === "CMMC_L2") {
    statuses = initObjectivesFromReport(report);
    saveObjectives(req.params.id, statuses);
  }

  // Merge objective definitions with statuses for a rich response
  const statusMap = new Map(statuses.map(s => [s.objectiveId, s]));

  const enriched = DIBCAC_OBJECTIVES.map(obj => ({
    ...obj,
    status: statusMap.get(obj.objectiveId) ?? {
      objectiveId:   obj.objectiveId,
      status:        obj.automation === "physical" ? "requires_physical" : "not_assessed",
      evidenceSource: "none",
    },
  }));

  res.json({
    reportId: req.params.id,
    summary:  buildObjectiveSummary(statuses),
    objectives: enriched,
  });
});

// ── DIBCAC Objectives: attest (manual attestation) ─────────────────────────

app.post("/api/reports/:id/objectives/:objId/attest", (req, res) => {
  const report = loadReport(req.params.id);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  const obj = DIBCAC_OBJECTIVES.find(o => o.objectiveId === req.params.objId);
  if (!obj) return void res.status(404).json({ error: "Objective not found" });

  const { attestationText, status, documentRef, documentName } = req.body as {
    attestationText?: string;
    status?: ObjectiveStatusValue;
    documentRef?: string;
    documentName?: string;
  };

  let statuses = loadObjectives(req.params.id);
  if (statuses.length === 0) {
    statuses = initObjectivesFromReport(report);
  }

  const idx = statuses.findIndex(s => s.objectiveId === req.params.objId);
  const updated: ObjectiveStatus = {
    objectiveId:     obj.objectiveId,
    status:          status ?? "met",
    evidenceSource:  documentRef ? "document_upload" : "manual_attestation",
    attestationText: attestationText,
    documentRef:     documentRef,
    documentName:    documentName,
    assessedAt:      new Date().toISOString(),
    assessedBy:      "manual",
  };

  if (idx >= 0) statuses[idx] = updated;
  else statuses.push(updated);

  saveObjectives(req.params.id, statuses);
  res.json({ ok: true, objective: updated, summary: buildObjectiveSummary(statuses) });
});

// ── DIBCAC Objectives: bulk reset (re-initialize from control assessments) ──

app.post("/api/reports/:id/objectives/reset", (req, res) => {
  const report = loadReport(req.params.id);
  if (!report) return void res.status(404).json({ error: "Report not found" });
  if (report.frameworkId !== "CMMC_L2")
    return void res.status(400).json({ error: "DIBCAC objectives only apply to CMMC L2 assessments" });

  const statuses = initObjectivesFromReport(report);
  saveObjectives(req.params.id, statuses);
  res.json({ ok: true, summary: buildObjectiveSummary(statuses) });
});

// ── DIBCAC Objectives: export as DIBCAC worksheet CSV ─────────────────────

app.get("/api/reports/:id/objectives/export/csv", (req, res) => {
  const report = loadReport(req.params.id);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  let statuses = loadObjectives(req.params.id);
  if (statuses.length === 0 && report.frameworkId === "CMMC_L2") {
    statuses = initObjectivesFromReport(report);
  }
  const statusMap = new Map(statuses.map(s => [s.objectiveId, s]));

  const HEADER = "Objective_Number,Objective_Text,Objective_Satisfied,Objective_Other_Than_Satisfied,Documents_Examined_Details,SME_Interviewed_Names,Validation_Text,Notes,Standard";

  const rows = DIBCAC_OBJECTIVES.map(obj => {
    const st = statusMap.get(obj.objectiveId);
    const satisfied   = st?.status === "met"  ? "TRUE" : "FALSE";
    const otherThanSat = (st?.status === "not_met" || st?.status === "requires_physical") ? "TRUE" : "FALSE";
    const docs        = (st?.documentName ?? "").replace(/,/g, ";");
    const validation  = (st?.attestationText ?? "").replace(/,/g, ";").replace(/\n/g, " ");
    const text        = obj.text.replace(/,/g, ";");
    return `${obj.objectiveId},"${text}",${satisfied},${otherThanSat},"${docs}",,${validation ? `"${validation}"` : ""},,${obj.standard}`;
  });

  const csv = [HEADER, ...rows].join("\n");
  const filename = `DIBCAC_Worksheet_${report.reportId}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.API_PORT ?? "3001");
app.listen(PORT, () => {
  const clients = listClients();
  console.log(`\n[INDEX] Compliance API  →  http://localhost:${PORT}`);
  console.log(`[INDEX] Clients         →  ${clients.length} configured${clients.length ? ` (${clients.map(c => c.name).join(", ")})` : " — open http://localhost:3000/setup"}`);
  const anthropicKey = resolveAnthropicKey();
  console.log(`[INDEX] Anthropic API   →  ${anthropicKey ? "✓ key present" : "✗ key not found (set ANTHROPIC_API_KEY)"}`);
  console.log(`[INDEX] Reports stored  →  ${REPORTS_DIR}\n`);
});
