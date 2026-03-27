// =============================================================================
// INDEX DSaaS — Compliance Dashboard REST API Server
// Express HTTP server that powers the web/ dashboard
// Runs on :3001 independently from the MCP server (src/index.ts)
// =============================================================================

// Load .env before anything else so process.env vars are available
import { config as loadDotenv } from "dotenv";
loadDotenv();

import express, { type Request, type Response, type NextFunction } from "express";
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
import { initEmail, sendTeamInviteEmail } from "./services/email.js";
import { Webhook } from "svix";

// ── Optional DB (Neon + Drizzle) — only loaded when DATABASE_URL is set ────
// When DATABASE_URL is absent the server falls back to file-based storage.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbSchema: typeof import("./db/schema.js") | null = null;
let drizzleOps: typeof import("drizzle-orm") | null = null;

async function initDB() {
  if (!process.env.DATABASE_URL) return;
  try {
    const [clientMod, schemaMod, ormMod] = await Promise.all([
      import("./db/client.js"),
      import("./db/schema.js"),
      import("drizzle-orm"),
    ]);
    db         = clientMod.db as any;
    dbSchema   = schemaMod;
    drizzleOps = ormMod as any;
    console.log("[INDEX] Database     →  Neon PostgreSQL ✓");
  } catch (err) {
    console.warn("[INDEX] Database     →  ⚠ failed to connect, falling back to file storage:", (err as Error).message);
  }
}

// ── Optional Clerk auth — only loaded when CLERK_SECRET_KEY is set ─────────
// verifyToken is a standalone export in @clerk/backend v3 — NOT a method on
// the ClerkClient instance. We store it as verifyFn so all callsites use it.
let clerkClient: {
  verifyFn: (token: string) => Promise<{ sub: string }>;
} | null = null;

async function initClerk() {
  if (!process.env.CLERK_SECRET_KEY) return;
  try {
    const { verifyToken } = await import("@clerk/backend");
    const secretKey = process.env.CLERK_SECRET_KEY;
    clerkClient = {
      verifyFn: (token: string) =>
        (verifyToken as any)(token, { secretKey, clockSkewInMs: 5000 }) as Promise<{ sub: string }>,
    };
    console.log("[INDEX] Auth         →  Clerk ✓");
  } catch (err) {
    console.warn("[INDEX] Auth         →  ⚠ Clerk failed to load:", (err as Error).message);
  }
}

// Augment Request type to carry the authenticated user id
export interface AuthedRequest extends Request { userId?: string; }

// ── Clerk JWT middleware (applied to all routes except /api/health) ─────────
// In dev (no CLERK_SECRET_KEY) every request is treated as the "dev" user.
const DEV_USER_ID = "dev";

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Health check is always public
  if (req.path === "/api/health") return next();

  // No Clerk configured → dev mode only (never in production)
  if (!clerkClient) {
    if (process.env.NODE_ENV === 'production') {
      return void res.status(503).json({ error: "Auth not configured" });
    }
    req.userId = DEV_USER_ID;
    return next();
  }

  // Accept token from Authorization header OR ?token= query param (for EventSource / SSE)
  const token = req.headers.authorization?.replace("Bearer ", "")
    ?? (req.query.token as string | undefined);
  if (!token) return void res.status(401).json({ error: "Unauthorized — no token" });

  const doVerify = () => clerkClient!.verifyFn(token);

  try {
    const payload = await doVerify();
    req.userId = payload.sub;
    return next();
  } catch (firstErr) {
    // Retry once — Railway cold start / JWKS fetch latency can fail the first attempt
    console.warn("[AUTH] verifyToken attempt 1 failed:", (firstErr as Error).message, "— retrying in 500ms");
    await new Promise(r => setTimeout(r, 500));
    try {
      const payload = await doVerify();
      req.userId = payload.sub;
      return next();
    } catch (secondErr) {
      console.error("[AUTH] verifyToken failed after retry:", (secondErr as Error).message);
      return void res.status(401).json({ error: "Unauthorized — invalid token" });
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Paths relative to dist/api-server.js  →  ../web/
const WEB_DIR     = join(__dirname, "..", "web");
const CONFIG_DIR  = join(WEB_DIR, ".config");
const REPORTS_DIR = join(WEB_DIR, ".reports");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Report persistence (DB-first, file fallback) ─────────────────────────

async function saveReport(report: ComplianceReport, userId: string = DEV_USER_ID) {
  if (db && dbSchema && drizzleOps) {
    const { reports: reportsTable } = dbSchema;
    const { eq } = drizzleOps;
    await (db as any).insert(reportsTable).values({
      id:          report.reportId,
      userId,
      frameworkId: report.frameworkId,
      data:        report,
      generatedAt: new Date(report.generatedAt),
    }).onConflictDoUpdate({
      target: reportsTable.id,
      set:    { data: report, generatedAt: new Date(report.generatedAt) },
    });
    return;
  }
  // File fallback
  ensureDir(REPORTS_DIR);
  writeFileSync(
    join(REPORTS_DIR, `${report.reportId}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );
}

async function loadReport(reportId: string, userId: string = DEV_USER_ID): Promise<ComplianceReport | null> {
  if (db && dbSchema && drizzleOps) {
    const { reports: reportsTable } = dbSchema;
    const { eq, and } = drizzleOps;
    const rows = await (db as any).select()
      .from(reportsTable)
      .where(and(eq(reportsTable.id, reportId), eq(reportsTable.userId, userId)));
    return rows[0]?.data as ComplianceReport ?? null;
  }
  // File fallback
  try {
    const f = join(REPORTS_DIR, `${reportId}.json`);
    if (!existsSync(f)) return null;
    return JSON.parse(readFileSync(f, "utf8")) as ComplianceReport;
  } catch { return null; }
}

async function listReportMetas(userId: string = DEV_USER_ID) {
  if (db && dbSchema && drizzleOps) {
    const { reports: reportsTable } = dbSchema;
    const { eq, desc } = drizzleOps;
    const rows = await (db as any).select().from(reportsTable)
      .where(eq(reportsTable.userId, userId))
      .orderBy(desc(reportsTable.generatedAt));
    return rows.map((row: any) => {
      const r = row.data as ComplianceReport;
      return {
        reportId:          r.reportId,
        frameworkId:       r.frameworkId,
        frameworkName:     r.frameworkName,
        tenantDisplayName: r.tenantDisplayName,
        generatedAt:       r.generatedAt,
        summary:           r.summary,
        clientId:          r.clientId,
        clientName:        r.clientName,
      };
    });
  }
  // File fallback
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
// Uses ?clientId query param if provided, otherwise the user's first client.
// userId scopes the lookup so users can only access their own clients.

async function resolveClient(clientIdParam?: string, userId?: string): Promise<Client | null> {
  if (clientIdParam) return getClient(clientIdParam, userId);
  return getDefaultClient(userId);
}

// ─── Express app ──────────────────────────────────────────────────────────

const app = express();
// Capture raw body on every request so the Clerk webhook handler can verify
// the Svix signature. The `verify` callback runs before JSON.parse.
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));

// CORS — allowed origins read from env var so the same binary works in dev and prod
// Dev default: http://localhost:3000
// Production (Vercel): set ALLOWED_ORIGINS=https://your-app.vercel.app
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  // Auto-allow any Vercel deployment so ALLOWED_ORIGINS doesn't need to be
  // updated for every preview deploy. Auth (Clerk JWT) is still enforced.
  const isVercel = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
  const allowed  = (allowedOrigins.has(origin) || isVercel) ? origin : [...allowedOrigins][0];
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ── Health ─────────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  const clients = await listClients();
  res.json({ ok: true, configured: clients.length > 0 });
});

// ── Config: status (backward compat — derives from clients list) ───────────

app.get("/api/config/status", async (req: AuthedRequest, res) => {
  const clients = await listClients(req.userId);
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

app.post("/api/config", async (req: AuthedRequest, res) => {
  const { tenantId, clientId, clientSecret, tenantName } = req.body as {
    tenantId?: string; clientId?: string; clientSecret?: string; tenantName?: string;
  };
  if (!tenantId || !clientId || !clientSecret)
    return void res.status(400).json({ error: "tenantId, clientId, and clientSecret are required" });

  const client = await upsertByTenantId({
    tenantId,
    clientId,
    clientSecret,
    name: tenantName ?? `Tenant ${tenantId.slice(0, 8)}`,
  }, req.userId ?? "default");
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
    testClient = await getDefaultClient();
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

app.get("/api/clients", async (req: AuthedRequest, res) => {
  const all = await listClients(req.userId);
  res.json(all.map(maskSecret));
});

// ── Clients: add ──────────────────────────────────────────────────────────

app.post("/api/clients", async (req: AuthedRequest, res) => {
  const { name, tenantId, clientId, clientSecret } = req.body as Partial<Client>;
  if (!name || !tenantId || !clientId || !clientSecret)
    return void res.status(400).json({ error: "name, tenantId, clientId, and clientSecret are required" });

  const client = await addClient({ name, tenantId, clientId, clientSecret }, req.userId ?? "default");
  res.status(201).json(maskSecret(client));
});

// ── Clients: update ───────────────────────────────────────────────────────

app.put("/api/clients/:id", async (req: AuthedRequest, res) => {
  const { name, tenantId, clientId, clientSecret } = req.body as Partial<Client>;
  // Only update secret if a non-empty value was supplied
  const patch: Partial<Omit<Client, "id" | "addedAt">> = {};
  if (name)         patch.name         = name;
  if (tenantId)     patch.tenantId     = tenantId;
  if (clientId)     patch.clientId     = clientId;
  if (clientSecret) patch.clientSecret = clientSecret;

  const updated = await updateClient(req.params.id, patch, req.userId);
  if (!updated) return void res.status(404).json({ error: "Client not found" });
  res.json(maskSecret(updated));
});

// ── Clients: delete ───────────────────────────────────────────────────────

app.delete("/api/clients/:id", async (req: AuthedRequest, res) => {
  const ok = await deleteClient(req.params.id, req.userId);
  if (!ok) return void res.status(404).json({ error: "Client not found" });
  res.json({ ok: true });
});

// ── Clients: test connection ───────────────────────────────────────────────

app.post("/api/clients/:id/test", async (req: AuthedRequest, res) => {
  const client = await getClient(req.params.id, req.userId);
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

// ── Clients: list integrations for a client ────────────────────────────────

app.get("/api/clients/:id/integrations", async (req, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { clientIntegrations: intTable } = dbSchema as any;
  const { eq } = drizzleOps as any;

  const rows = await (db as any).select().from(intTable)
    .where(eq(intTable.clientId, req.params.id));

  res.json(rows.map((r: any) => ({
    id:           r.id,
    platform:     r.platform,
    status:       r.status,
    connectedAt:  r.connectedAt,
    lastTestedAt: r.lastTestedAt,
    errorMessage: r.errorMessage,
  })));
});

// ── Clients: save integration credentials (MSP-authenticated) ─────────────

app.put("/api/clients/:id/integrations/:platform", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }

  const { id: clientId, platform } = req.params;
  const { config } = req.body as { config?: Record<string, string> };
  if (!config) return void res.status(400).json({ error: "config is required" });

  // Verify client belongs to this user
  const { clients: clientTable, clientIntegrations: intTable } = dbSchema as any;
  const { eq, and } = drizzleOps as any;
  const clientRows = await (db as any).select().from(clientTable)
    .where(and(eq(clientTable.id, clientId), eq(clientTable.userId, (req as any).userId)));
  if (!clientRows[0]) return void res.status(404).json({ error: "Client not found" });

  // Upsert the integration record
  const existing = await (db as any).select().from(intTable)
    .where(and(eq(intTable.clientId, clientId), eq(intTable.platform, platform)));

  if (existing[0]) {
    await (db as any).update(intTable)
      .set({ config, status: "pending" })
      .where(and(eq(intTable.clientId, clientId), eq(intTable.platform, platform)));
  } else {
    await (db as any).insert(intTable).values({
      clientId,
      userId: (req as any).userId,
      platform,
      config,
      status: "pending",
    });
  }

  res.json({ ok: true });
});

// ── Clients: test integration (MSP-authenticated) ──────────────────────────

app.post("/api/clients/:id/integrations/:platform/test", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }

  const { id: clientId, platform } = req.params;
  const { config } = req.body as { config?: Record<string, string> };
  if (!config) return void res.status(400).json({ error: "config is required" });

  // Verify client belongs to this user
  const { clients: clientTable, clientIntegrations: intTable } = dbSchema as any;
  const { eq, and } = drizzleOps as any;
  const clientRows = await (db as any).select().from(clientTable)
    .where(and(eq(clientTable.id, clientId), eq(clientTable.userId, (req as any).userId)));
  if (!clientRows[0]) return void res.status(404).json({ error: "Client not found" });

  // For other platforms: validate required fields and optionally HTTP probe
  const platformsWithUrl: Record<string, string | null> = {
    servicenow: config.instanceUrl ?? null,
    splunk:     config.baseUrl     ?? null,
    jira:       config.domain      ? `https://${config.domain}` : null,
    workday:    config.baseUrl     ?? null,
  };

  const urlToProbe = platformsWithUrl[platform];
  if (urlToProbe) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      await fetch(urlToProbe, {
        method: "HEAD",
        signal: controller.signal as any,
        redirect: "follow",
      }).finally(() => clearTimeout(timeout));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        return void res.json({
          ok: false,
          error: `Could not reach ${urlToProbe} — check the URL and try again`,
        });
      }
    }
  }

  // Mark as connected
  const existing = await (db as any).select().from(intTable)
    .where(and(eq(intTable.clientId, clientId), eq(intTable.platform, platform)));

  if (existing[0]) {
    await (db as any).update(intTable)
      .set({ status: "connected", connectedAt: new Date(), lastTestedAt: new Date(), errorMessage: null })
      .where(and(eq(intTable.clientId, clientId), eq(intTable.platform, platform)));
  } else {
    await (db as any).insert(intTable).values({
      clientId,
      userId: (req as any).userId,
      platform,
      config,
      status: "connected",
      connectedAt: new Date(),
      lastTestedAt: new Date(),
    });
  }

  res.json({ ok: true });
});

// ── Invitations: list ──────────────────────────────────────────────────────

app.get("/api/invitations", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { clientInvitations: invTable } = dbSchema as any;
  const { eq, desc } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  const rows = await (db as any).select().from(invTable)
    .where(eq(invTable.userId, userId))
    .orderBy(desc(invTable.createdAt));

  res.json(rows.map((r: any) => ({
    id:         r.id,
    clientName: r.clientName,
    email:      r.email,
    token:      r.token,
    status:     r.status,
    createdAt:  r.createdAt,
    expiresAt:  r.expiresAt,
    clientId:   r.clientId,
  })));
});

// ── Invitations: create ────────────────────────────────────────────────────

app.post("/api/invitations", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { clientName, email } = req.body as { clientName?: string; email?: string };
  if (!clientName?.trim()) {
    return void res.status(400).json({ error: "clientName is required" });
  }

  const { clientInvitations: invTable } = dbSchema as any;
  const userId = req.userId ?? DEV_USER_ID;

  // Generate a UUID token — hard to guess, used in the /onboard/:token URL
  const { randomUUID } = await import("crypto");
  const token     = randomUUID();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

  const [inv] = await (db as any).insert(invTable).values({
    userId,
    token,
    clientName: clientName.trim(),
    email:      email?.trim() ?? null,
    status:     "pending",
    expiresAt,
  }).returning();

  // Build the public link using the request origin or HOST header
  const host = req.headers.origin
    ?? `${req.protocol}://${req.headers.host}`;
  const link = `${host}/onboard/${token}`;

  res.status(201).json({
    id:         inv.id,
    token:      inv.token,
    link,
    expiresAt:  inv.expiresAt,
    clientName: inv.clientName,
  });
});

// ── Invitations: revoke ────────────────────────────────────────────────────

app.delete("/api/invitations/:id", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { clientInvitations: invTable } = dbSchema as any;
  const { eq, and } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  await (db as any).update(invTable)
    .set({ status: "revoked" })
    .where(and(eq(invTable.id, req.params.id), eq(invTable.userId, userId)));

  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEAM INVITE ROUTES (auth-scoped)
// ═══════════════════════════════════════════════════════════════════════════

// ── Team: list sent invites ────────────────────────────────────────────────

app.get("/api/team/invites", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { teamInvitations: invTable } = dbSchema as any;
  const { eq, desc } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  const rows = await (db as any).select().from(invTable)
    .where(eq(invTable.ownerId, userId))
    .orderBy(desc(invTable.createdAt));

  res.json(rows.map((r: any) => ({
    id:        r.id,
    email:     r.email,
    token:     r.token,
    status:    r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  })));
});

// ── Team: create invite ────────────────────────────────────────────────────

app.post("/api/team/invites", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    return void res.status(400).json({ error: "email is required" });
  }

  const { teamInvitations: invTable } = dbSchema as any;
  const userId = req.userId ?? DEV_USER_ID;

  const { randomUUID } = await import("crypto");
  const token     = randomUUID();
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  const [inv] = await (db as any).insert(invTable).values({
    ownerId:  userId,
    email:    email.trim(),
    token,
    status:   "pending",
    expiresAt,
  }).returning();

  const host = req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
  const link = `${host}/join/${token}`;

  // Send invite email — fire-and-forget, don't block the response
  // Optionally look up the inviter's name from Clerk for a personalised message
  void (async () => {
    try {
      let senderName: string | undefined;
      if (clerkClient && userId !== DEV_USER_ID) {
        try {
          const user = await (clerkClient as any).users.getUser(userId);
          senderName = user.firstName ?? user.username ?? undefined;
        } catch { /* name lookup is best-effort */ }
      }
      await sendTeamInviteEmail({
        to:         inv.email,
        inviteLink: link,
        expiresAt:  new Date(inv.expiresAt),
        senderName,
      });
    } catch (err) {
      console.error("[EMAIL] Failed to send team invite email:", (err as Error).message);
    }
  })();

  res.status(201).json({
    id:        inv.id,
    token:     inv.token,
    link,
    expiresAt: inv.expiresAt,
    email:     inv.email,
  });
});

// ── Team: revoke invite ────────────────────────────────────────────────────

app.delete("/api/team/invites/:id", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { teamInvitations: invTable } = dbSchema as any;
  const { eq, and } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  await (db as any).update(invTable)
    .set({ status: "revoked" })
    .where(and(eq(invTable.id, req.params.id), eq(invTable.ownerId, userId)));

  res.json({ ok: true });
});

// ── Team: list members ─────────────────────────────────────────────────────

app.get("/api/team/members", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { teamMemberships: membTable } = dbSchema as any;
  const { eq } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  const rows = await (db as any).select().from(membTable)
    .where(eq(membTable.ownerId, userId));

  res.json(rows.map((r: any) => ({
    id:       r.id,
    memberId: r.memberId,
    joinedAt: r.joinedAt,
  })));
});

// ── Team: remove member ────────────────────────────────────────────────────

app.delete("/api/team/members/:id", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { teamMemberships: membTable } = dbSchema as any;
  const { eq, and } = drizzleOps as any;
  const userId = req.userId ?? DEV_USER_ID;

  await (db as any).delete(membTable)
    .where(and(eq(membTable.id, req.params.id), eq(membTable.ownerId, userId)));

  res.json({ ok: true });
});

// ── Team: get join info (PUBLIC — no auth needed to view invite page) ──────

app.get("/api/team/join/:token", async (req, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }
  const { teamInvitations: invTable } = dbSchema as any;
  const { eq } = drizzleOps as any;

  const rows = await (db as any).select().from(invTable)
    .where(eq(invTable.token, req.params.token)).limit(1);

  if (rows.length === 0) return void res.status(404).json({ error: "Invite not found" });
  const inv = rows[0];

  if (inv.status === "revoked") {
    return void res.status(410).json({ error: "This invite has been revoked" });
  }
  if (new Date(inv.expiresAt) < new Date()) {
    return void res.status(410).json({ error: "This invite has expired" });
  }
  if (inv.status === "accepted") {
    return void res.json({ email: inv.email, status: "accepted", alreadyAccepted: true });
  }

  res.json({ email: inv.email, status: inv.status, expiresAt: inv.expiresAt });
});

// ── Team: accept invite (PUBLIC endpoint — manually verifies Clerk JWT) ────
// Registered before app.use(requireAuth) so the route is reachable unauthenticated.
// Auth is enforced manually here so we can return a clear 401 for the join page.

app.post("/api/team/join/:token/accept", async (req: AuthedRequest, res) => {
  if (!db || !dbSchema || !drizzleOps) {
    return void res.status(503).json({ error: "Database not configured" });
  }

  // Manual Clerk JWT verification (route registered before requireAuth middleware)
  const bearerToken = req.headers.authorization?.replace("Bearer ", "")
    ?? (req.query.token as string | undefined);

  let memberId = DEV_USER_ID;
  if (clerkClient) {
    if (!bearerToken) return void res.status(401).json({ error: "Sign in to accept this invite" });
    try {
      const payload = await clerkClient.verifyFn(bearerToken);
      memberId = payload.sub;
    } catch {
      return void res.status(401).json({ error: "Unauthorized — invalid token" });
    }
  }

  const { teamInvitations: invTable, teamMemberships: membTable } = dbSchema as any;
  const { eq } = drizzleOps as any;

  const rows = await (db as any).select().from(invTable)
    .where(eq(invTable.token, req.params.token)).limit(1);

  if (rows.length === 0) return void res.status(404).json({ error: "Invite not found" });
  const inv = rows[0];

  if (inv.status === "revoked")                      return void res.status(410).json({ error: "This invite has been revoked" });
  if (new Date(inv.expiresAt) < new Date())           return void res.status(410).json({ error: "This invite has expired" });
  if (inv.ownerId === memberId)                       return void res.status(400).json({ error: "You cannot accept your own invite" });
  if (inv.status === "accepted")                      return void res.json({ ok: true, alreadyAccepted: true });

  // Create membership (ignore duplicate)
  await (db as any).insert(membTable).values({
    ownerId:      inv.ownerId,
    memberId,
    invitationId: inv.id,
  }).onConflictDoNothing();

  // Mark invite as accepted
  await (db as any).update(invTable)
    .set({ status: "accepted" })
    .where(eq(invTable.id, inv.id));

  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ONBOARD ROUTES — no Clerk auth required
// These must be registered before app.use(requireAuth) to stay public.
// The requireAuth middleware also explicitly skips /api/onboard/* paths.
// ═══════════════════════════════════════════════════════════════════════════

// Helper: validate a token from DB — returns the invitation row or sends error
async function resolveInvitation(
  token: string,
  res: Response,
  allowAccepted = false
): Promise<any | null> {
  if (!db || !dbSchema || !drizzleOps) {
    res.status(503).json({ error: "Database not configured" });
    return null;
  }
  const { clientInvitations: invTable } = dbSchema as any;
  const { eq } = drizzleOps as any;

  const rows = await (db as any).select().from(invTable).where(eq(invTable.token, token));
  const inv  = rows[0];

  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return null;
  }
  if (inv.status === "revoked") {
    res.status(410).json({ error: "This invitation link has been revoked" });
    return null;
  }
  if (!allowAccepted && inv.status === "accepted") {
    // Accepted invitations can still be used to add more integrations
  }
  if (new Date(inv.expiresAt) < new Date()) {
    res.status(410).json({ error: "This invitation link has expired" });
    return null;
  }
  return inv;
}

// ── Onboard: get invitation info ───────────────────────────────────────────

app.get("/api/onboard/:token", async (req, res) => {
  const inv = await resolveInvitation(req.params.token, res, true);
  if (!inv) return;

  res.json({
    clientName: inv.clientName,
    email:      inv.email,
    status:     inv.status,
    expiresAt:  inv.expiresAt,
  });
});

// ── Onboard: complete (submit company details + M365 creds → create client) ─

app.post("/api/onboard/:token/complete", async (req, res) => {
  const inv = await resolveInvitation(req.params.token, res);
  if (!inv) return;

  // If already accepted, return the existing clientId
  if (inv.status === "accepted" && inv.clientId) {
    return void res.json({ ok: true, clientId: inv.clientId });
  }

  const { companyName, contactName, contactEmail, tenantId, clientId: azureClientId, clientSecret } =
    req.body as {
      companyName?: string; contactName?: string; contactEmail?: string;
      tenantId?: string; clientId?: string; clientSecret?: string;
    };

  if (!companyName || !tenantId || !azureClientId || !clientSecret) {
    return void res.status(400).json({
      error: "companyName, tenantId, clientId, and clientSecret are required",
    });
  }

  // Create client record using the existing client manager
  const client = await addClient({
    name:         companyName.trim(),
    tenantId:     tenantId.trim(),
    clientId:     azureClientId.trim(),
    clientSecret: clientSecret.trim(),
  }, inv.userId);

  // Update invitation to accepted
  const { clientInvitations: invTable } = dbSchema as any;
  const { eq } = drizzleOps as any;
  await (db as any).update(invTable)
    .set({ status: "accepted", clientId: client.id })
    .where(eq(invTable.token, req.params.token));

  // Store contact info as a passive integration record
  if (contactName || contactEmail) {
    const { clientIntegrations: intTable } = dbSchema as any;
    await (db as any).insert(intTable)
      .values({
        clientId: client.id,
        userId:   inv.userId,
        platform: "_contact",
        config:   { contactName, contactEmail },
        status:   "connected",
        connectedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  res.json({ ok: true, clientId: client.id });
});

// ── Onboard: save integration credentials ─────────────────────────────────

app.put("/api/onboard/:token/integrations/:platform", async (req, res) => {
  const inv = await resolveInvitation(req.params.token, res, true);
  if (!inv) return;

  if (!inv.clientId) {
    return void res.status(400).json({ error: "Complete Microsoft 365 setup first" });
  }

  const { config } = req.body as { config?: object };
  if (!config) return void res.status(400).json({ error: "config is required" });

  const { clientIntegrations: intTable } = dbSchema as any;

  await (db as any).insert(intTable)
    .values({
      clientId: inv.clientId,
      userId:   inv.userId,
      platform: req.params.platform,
      config,
      status:   "pending",
    })
    .onConflictDoUpdate({
      target: [intTable.clientId, intTable.platform],
      set:    { config, status: "pending", errorMessage: null },
    });

  res.json({ ok: true });
});

// ── Onboard: test integration credentials ────────────────────────────────

app.post("/api/onboard/:token/integrations/:platform/test", async (req, res) => {
  const inv = await resolveInvitation(req.params.token, res, true);
  if (!inv) return;

  const { config } = req.body as { config?: Record<string, string> };
  if (!config) return void res.status(400).json({ error: "config is required" });

  const platform = req.params.platform;

  // For Entra ID / M365: use the existing testConfig logic
  if (platform === "entra_id") {
    const { tenantId, clientId: azureClientId, clientSecret } = config;
    if (!tenantId || !azureClientId || !clientSecret) {
      return void res.status(400).json({ error: "tenantId, clientId, and clientSecret are required" });
    }

    const testCl: Client = {
      id: "test", name: "test",
      tenantId, clientId: azureClientId, clientSecret,
      addedAt: new Date().toISOString(),
    };
    const graphClient = makeGraphClient(testCl);

    const probes = [
      {
        path: "/organization",
        extract: (d: any) => {
          const o = d.value?.[0];
          return { name: o?.displayName, domain: o?.verifiedDomains?.find((v: any) => v.isDefault)?.name };
        },
      },
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
          return void res.status(200).json({ ok: false, error: `Authentication failed: ${msg}` });
        }
      }
    }

    const displayName = tenantName ?? (domain ? `Tenant (${domain})` : `Tenant ${tenantId}`);

    // Update integration record if client exists
    if (inv.clientId && db && dbSchema && drizzleOps) {
      const { clientIntegrations: intTable } = dbSchema as any;
      const { eq, and } = drizzleOps as any;
      await (db as any).update(intTable)
        .set({ status: "connected", connectedAt: new Date(), lastTestedAt: new Date() })
        .where(and(eq(intTable.clientId, inv.clientId), eq(intTable.platform, "entra_id")));
    }

    return void res.json({ ok: true, tenantName: displayName, domain: domain ?? "" });
  }

  // For other platforms: validate that required fields are present and non-empty,
  // then attempt a basic HTTP connectivity probe where applicable.
  const platformsWithUrl: Record<string, string | null> = {
    servicenow: config.instanceUrl ?? null,
    splunk:     config.baseUrl     ?? null,
    jira:       config.domain      ? `https://${config.domain}` : null,
    workday:    config.baseUrl     ?? null,
  };

  const urlToProbe = platformsWithUrl[platform];

  if (urlToProbe) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(urlToProbe, {
        method: "HEAD",
        signal: controller.signal as any,
        redirect: "follow",
      }).finally(() => clearTimeout(timeout));
      // Any HTTP response (even 401/403) means the host is reachable
      void r;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        return void res.json({
          ok: false,
          error: `Could not reach ${urlToProbe} — check the URL and try again`,
        });
      }
      // Other errors (SSL, redirect loop) still mean host is reachable
    }
  }

  // Save as connected
  if (inv.clientId && db && dbSchema && drizzleOps) {
    const { clientIntegrations: intTable } = dbSchema as any;
    const { eq, and } = drizzleOps as any;
    await (db as any).update(intTable)
      .set({ status: "connected", connectedAt: new Date(), lastTestedAt: new Date() })
      .where(and(eq(intTable.clientId, inv.clientId), eq(intTable.platform, platform)));
  }

  res.json({ ok: true });
});

// ── Onboard: get saved integrations for this token's client ───────────────

app.get("/api/onboard/:token/integrations", async (req, res) => {
  const inv = await resolveInvitation(req.params.token, res, true);
  if (!inv) return;

  if (!inv.clientId) return void res.json([]);

  const { clientIntegrations: intTable } = dbSchema as any;
  const { eq } = drizzleOps as any;

  const rows = await (db as any).select().from(intTable)
    .where(eq(intTable.clientId, inv.clientId));

  res.json(rows.map((r: any) => ({
    platform:     r.platform,
    status:       r.status,
    connectedAt:  r.connectedAt,
    lastTestedAt: r.lastTestedAt,
    errorMessage: r.errorMessage,
  })));
});

// ═══════════════════════════════════════════════════════════════════════════
// ALL ROUTES BELOW THIS LINE REQUIRE CLERK JWT AUTHENTICATION
// requireAuth is applied here (not in start()) so Express processes it
// before any protected route handler — registration order matters.
// ═══════════════════════════════════════════════════════════════════════════
app.use(requireAuth as any);

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

app.get("/api/assess/stream/:frameworkId", async (req: AuthedRequest, res) => {
  const client = await resolveClient(req.query.clientId as string | undefined, req.userId);
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

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");  // disable proxy buffering (Nginx/Vercel/CloudFront)
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

  await saveReport(report, req.userId);

  // Auto-initialize DIBCAC 320 objectives for CMMC L2 assessments
  if (report.frameworkId === "CMMC_L2") {
    const objStatuses = initObjectivesFromReport(report);
    await saveObjectives(report.reportId, objStatuses);
    const objSummary = buildObjectiveSummary(objStatuses);
    send({ type: "objectives_initialized", reportId: report.reportId, summary: objSummary });
  }

  send({ type: "complete", report });
  res.end();
});

// ── Assess: single control ─────────────────────────────────────────────────

app.post("/api/assess/:frameworkId/control/:controlId", async (req: AuthedRequest, res) => {
  const client = await resolveClient(req.query.clientId as string | undefined, req.userId);
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

app.get("/api/reports", async (req: AuthedRequest, res) => {
  res.json(await listReportMetas(req.userId));
});

app.get("/api/reports/:id", async (req: AuthedRequest, res) => {
  const r = await loadReport(req.params.id, req.userId);
  if (!r) return void res.status(404).json({ error: "Not found" });
  res.json(r);
});

app.delete("/api/reports/:id", async (req: AuthedRequest, res) => {
  if (db && dbSchema && drizzleOps) {
    const { reports: reportsTable } = dbSchema;
    const { eq, and } = drizzleOps;
    const deleted = await (db as any).delete(reportsTable)
      .where(and(eq(reportsTable.id, req.params.id), eq(reportsTable.userId, req.userId!)));
    if (deleted.rowCount === 0) return void res.status(404).json({ error: "Not found" });
    return void res.json({ ok: true });
  }
  // File fallback
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

app.get("/api/reports/:id/export/word", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
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

async function loadObjectives(reportId: string): Promise<ObjectiveStatus[]> {
  if (db && dbSchema && drizzleOps) {
    const { objectiveStatuses } = dbSchema;
    const { eq } = drizzleOps;
    const rows = await (db as any).select().from(objectiveStatuses)
      .where(eq(objectiveStatuses.reportId, reportId));
    return rows.map((r: any) => ({
      objectiveId:     r.objectiveId,
      status:          r.status,
      evidenceSource:  r.evidenceSource ?? "none",
      attestationText: r.attestationText ?? undefined,
      documentRef:     r.documentRef ?? undefined,
      documentName:    r.documentName ?? undefined,
      assessedAt:      r.assessedAt?.toISOString() ?? undefined,
      assessedBy:      r.assessedBy ?? undefined,
    })) as ObjectiveStatus[];
  }
  // File fallback
  try {
    const f = objectivesPath(reportId);
    if (!existsSync(f)) return [];
    return JSON.parse(readFileSync(f, "utf8")) as ObjectiveStatus[];
  } catch { return []; }
}

async function saveObjectives(reportId: string, statuses: ObjectiveStatus[]) {
  if (db && dbSchema && drizzleOps) {
    const { objectiveStatuses } = dbSchema;
    const { eq } = drizzleOps;
    // Bulk upsert — delete existing then insert (simpler than per-row upsert for 320 rows)
    await (db as any).delete(objectiveStatuses).where(eq(objectiveStatuses.reportId, reportId));
    if (statuses.length > 0) {
      const rows = statuses.map(s => ({
        reportId:        reportId,
        objectiveId:     s.objectiveId,
        status:          s.status,
        evidenceSource:  s.evidenceSource ?? null,
        attestationText: s.attestationText ?? null,
        documentRef:     s.documentRef ?? null,
        documentName:    s.documentName ?? null,
        assessedAt:      s.assessedAt ? new Date(s.assessedAt) : null,
        assessedBy:      s.assessedBy ?? null,
      }));
      // Insert in batches of 100 to stay within Neon's parameter limits
      for (let i = 0; i < rows.length; i += 100) {
        await (db as any).insert(objectiveStatuses).values(rows.slice(i, i + 100));
      }
    }
    return;
  }
  // File fallback
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

app.get("/api/reports/:id/objectives", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  let statuses = await loadObjectives(req.params.id);

  // Auto-initialize if not yet done (e.g. reports created before this feature)
  if (statuses.length === 0 && report.frameworkId === "CMMC_L2") {
    statuses = initObjectivesFromReport(report);
    await saveObjectives(req.params.id, statuses);
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

app.post("/api/reports/:id/objectives/:objId/attest", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  const obj = DIBCAC_OBJECTIVES.find(o => o.objectiveId === req.params.objId);
  if (!obj) return void res.status(404).json({ error: "Objective not found" });

  const { attestationText, status, documentRef, documentName } = req.body as {
    attestationText?: string;
    status?: ObjectiveStatusValue;
    documentRef?: string;
    documentName?: string;
  };

  let statuses = await loadObjectives(req.params.id);
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
    assessedBy:      req.userId ?? "manual",
  };

  if (idx >= 0) statuses[idx] = updated;
  else statuses.push(updated);

  await saveObjectives(req.params.id, statuses);
  res.json({ ok: true, objective: updated, summary: buildObjectiveSummary(statuses) });
});

// ── DIBCAC Objectives: bulk reset (re-initialize from control assessments) ──

app.post("/api/reports/:id/objectives/reset", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });
  if (report.frameworkId !== "CMMC_L2")
    return void res.status(400).json({ error: "DIBCAC objectives only apply to CMMC L2 assessments" });

  const statuses = initObjectivesFromReport(report);
  await saveObjectives(req.params.id, statuses);
  res.json({ ok: true, summary: buildObjectiveSummary(statuses) });
});

// ── DIBCAC Objectives: export as DIBCAC worksheet CSV ─────────────────────

app.get("/api/reports/:id/objectives/export/csv", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  let statuses = await loadObjectives(req.params.id);
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

// =============================================================================
// OPA EXPORT  (Operational Plan of Action — customer-facing, NOT POA&M)
// GET /api/reports/:id/export/opa
// =============================================================================

app.get("/api/reports/:id/export/opa", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  try {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType } = await import("docx");

    const failed = report.controlAssessments.filter(c => c.status === "fail" || c.status === "partial");

    const border = { style: BorderStyle.SINGLE, size: 1, color: "E4E7EC" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const headerShading = { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" };
    const cellMargins = { top: 100, bottom: 100, left: 120, right: 120 };

    const controlRows = failed.map((c, idx) =>
      new TableRow({
        children: [
          new TableCell({
            borders, margins: cellMargins, width: { size: 700, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: c.controlId, size: 18, font: "Arial" })] })],
          }),
          new TableCell({
            borders, margins: cellMargins, width: { size: 2500, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: c.controlTitle ?? c.controlId, size: 18, font: "Arial" })] })],
          }),
          new TableCell({
            borders, margins: cellMargins, width: { size: 1200, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({
              children: [new TextRun({
                text: c.status === "fail" ? "Not Satisfied" : "Partially Satisfied",
                size: 18, font: "Arial",
                color: c.status === "fail" ? "DC2626" : "D97706",
              })],
            })],
          }),
          new TableCell({
            borders, margins: cellMargins, width: { size: 3000, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: (c.recommendations?.[0]) ?? "Remediation required — see full report.", size: 18, font: "Arial" })] })],
          }),
          new TableCell({
            borders, margins: cellMargins, width: { size: 900, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: "Open", size: 18, font: "Arial" })] })],
          }),
          new TableCell({
            borders, margins: cellMargins, width: { size: 1060, type: WidthType.DXA },
            shading: idx % 2 !== 0 ? { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: "", size: 18, font: "Arial" })] })],
          }),
        ],
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openItemsBlock: any[] = failed.length === 0
      ? [new Paragraph({ children: [new TextRun({ text: "All controls are satisfied. No open items.", size: 22, font: "Arial", color: "16A34A" })] })]
      : [new Table({
          width: { size: 13680, type: WidthType.DXA },
          columnWidths: [700, 2500, 1200, 3000, 900, 1060],
          rows: [
            new TableRow({
              tableHeader: true,
              children: (
                [["Control ID", 700], ["Control Name", 2500], ["Status", 1200],
                 ["Remediation Action", 3000], ["OPA Status", 900], ["Target Date", 1060]] as [string, number][]
              ).map(([label, width]) =>
                new TableCell({
                  borders, margins: cellMargins, shading: headerShading,
                  width: { size: width, type: WidthType.DXA },
                  children: [new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: label, bold: true, size: 18, font: "Arial" })],
                  })],
                })
              ),
            }),
            ...controlRows,
          ],
        })];

    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 36, bold: true, font: "Arial", color: "1C1D1F" },
            paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 28, bold: true, font: "Arial", color: "1C1D1F" },
            paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 15840, height: 12240 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Operational Plan of Action (OPA)", bold: true, size: 40, font: "Arial" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Organisation: ", bold: true, size: 22, font: "Arial" }),
              new TextRun({ text: report.tenantDisplayName ?? "—", size: 22, font: "Arial" }),
              new TextRun({ text: "   Framework: ", bold: true, size: 22, font: "Arial" }),
              new TextRun({ text: report.frameworkName, size: 22, font: "Arial" }),
              new TextRun({ text: "   Generated: ", bold: true, size: 22, font: "Arial" }),
              new TextRun({ text: new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), size: 22, font: "Arial" }),
              new TextRun({ text: "   Score: ", bold: true, size: 22, font: "Arial" }),
              new TextRun({ text: `${report.summary.compliancePercentage}%`, size: 22, font: "Arial" }),
            ],
            spacing: { after: 240 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "This OPA documents controls that are not yet fully satisfied and the planned remediation actions. It is an internal tracking document — NOT a C3PAO-issued POA&M.",
              size: 20, font: "Arial", italics: true, color: "505967",
            })],
            spacing: { after: 360 },
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Summary", bold: true, size: 28, font: "Arial" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Total: ${report.controlAssessments.length}   `, size: 22, font: "Arial" }),
              new TextRun({ text: `Passed: ${report.summary.passed}   `, size: 22, font: "Arial", color: "16A34A" }),
              new TextRun({ text: `Partial: ${report.summary.partial}   `, size: 22, font: "Arial", color: "D97706" }),
              new TextRun({ text: `Failed: ${report.summary.failed}   `, size: 22, font: "Arial", color: "DC2626" }),
            ],
            spacing: { after: 360 },
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: `Open Items (${failed.length})`, bold: true, size: 28, font: "Arial" })],
          }),
          ...openItemsBlock,
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safe   = report.frameworkName.replace(/[^a-z0-9]/gi, "_");
    const tenant = (report.tenantDisplayName ?? "tenant").replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="OPA_${safe}_${tenant}_${report.reportId}.docx"`);
    res.end(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OPA Export]", msg);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================================
// STRUCTURED EVIDENCE ZIP EXPORT
// GET /api/reports/:id/export/zip
// =============================================================================

app.get("/api/reports/:id/export/zip", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  try {
    const JSZip = (await import("jszip")).default;
    const { createHash } = await import("crypto");
    const zip = new JSZip();

    for (const control of report.controlAssessments) {
      const family = (control.family ?? control.frameworkId ?? "other").replace(/[^a-z0-9_\-]/gi, "_");
      const ctrlId = control.controlId.replace(/[^a-z0-9_\-\.]/gi, "_");
      const folder = zip.folder(`${family}/${ctrlId}`)!;

      folder.file("assessment_data.json", JSON.stringify({
        controlId: control.controlId, controlTitle: control.controlTitle,
        family: control.family, status: control.status,
        recommendations: control.recommendations ?? [],
        findings: control.findings ?? [],
        evidenceCollected: control.evidenceCollected ?? [],
        assessedAt: report.generatedAt, framework: report.frameworkName,
        tenant: report.tenantDisplayName, reportId: report.reportId,
      }, null, 2));

      folder.file("evidence_summary.txt", [
        `Control:    ${control.controlId} — ${control.controlTitle ?? ""}`,
        `Status:     ${control.status.toUpperCase()}`,
        `Framework:  ${report.frameworkName}`,
        `Tenant:     ${report.tenantDisplayName}`,
        `Assessed:   ${new Date(report.generatedAt).toISOString()}`,
        "",
        "Recommendations:",
        ...(control.recommendations?.map((r, i) => `  ${i + 1}. ${r}`) ?? ["  No recommendations provided."]),
      ].join("\n"));
    }

    const manifest = {
      reportId: report.reportId, framework: report.frameworkName,
      tenant: report.tenantDisplayName, generatedAt: report.generatedAt,
      exportedAt: new Date().toISOString(),
      totalControls: report.controlAssessments.length,
      passed: report.summary.passed, partial: report.summary.partial,
      failed: report.summary.failed, notAssessed: report.summary.notAssessed,
      compliancePercentage: report.summary.compliancePercentage,
    };
    const manifestStr = JSON.stringify(manifest, null, 2);
    zip.file("manifest.json", manifestStr);
    zip.file("MANIFEST.sha256", `${createHash("sha256").update(manifestStr).digest("hex")}  manifest.json\n`);
    zip.file("README.txt", [
      "INDEX Compliance Platform — Evidence Package",
      "============================================",
      `Report:   ${report.reportId}`,
      `Exported: ${new Date().toISOString()}`,
      "",
      "Structure: <family>/<control_id>/assessment_data.json",
      "           <family>/<control_id>/evidence_summary.txt",
      "Verify integrity: sha256sum -c MANIFEST.sha256",
    ].join("\n"));

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const safe   = report.frameworkName.replace(/[^a-z0-9]/gi, "_");
    const tenant = (report.tenantDisplayName ?? "tenant").replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="Evidence_${safe}_${tenant}_${report.reportId}.zip"`);
    res.end(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ZIP Export]", msg);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// =============================================================================
// EVIDENCE FILE UPLOAD / LIST / DELETE / DOWNLOAD
// POST   /api/reports/:id/objectives/:objId/files
// GET    /api/reports/:id/objectives/:objId/files
// DELETE /api/reports/:id/objectives/:objId/files/:fileId
// GET    /api/reports/:id/objectives/:objId/files/:fileId/download
// =============================================================================

const EVIDENCE_FILES_DIR = join(WEB_DIR, ".evidence-files");

interface EvidenceFileRecord {
  id: string; reportId: string; objectiveId: string; userId: string;
  fileName: string; originalName: string; fileSize: number;
  mimeType: string; content: string; uploadedAt: string;
}

function evidenceFilesPath(reportId: string) {
  ensureDir(EVIDENCE_FILES_DIR);
  return join(EVIDENCE_FILES_DIR, `${reportId}.json`);
}

async function loadEvidenceFiles(reportId: string, objectiveId?: string): Promise<EvidenceFileRecord[]> {
  if (db && dbSchema && drizzleOps) {
    const { evidenceFiles } = dbSchema as any;
    if (!evidenceFiles) return [];
    const { eq, and } = drizzleOps;
    const conds = [eq(evidenceFiles.reportId, reportId)];
    if (objectiveId) conds.push(eq(evidenceFiles.objectiveId, objectiveId));
    const rows = await (db as any).select().from(evidenceFiles).where(and(...conds));
    return rows.map((r: any) => ({
      id: r.id, reportId: r.reportId, objectiveId: r.objectiveId,
      userId: r.userId, fileName: r.fileName, originalName: r.originalName,
      fileSize: r.fileSize, mimeType: r.mimeType, content: r.content,
      uploadedAt: r.uploadedAt?.toISOString() ?? new Date().toISOString(),
    }));
  }
  const p = evidenceFilesPath(reportId);
  if (!existsSync(p)) return [];
  const all: EvidenceFileRecord[] = JSON.parse(readFileSync(p, "utf8"));
  return objectiveId ? all.filter(f => f.objectiveId === objectiveId) : all;
}

async function saveEvidenceFile(record: EvidenceFileRecord): Promise<void> {
  if (db && dbSchema && drizzleOps) {
    const { evidenceFiles } = dbSchema as any;
    if (!evidenceFiles) return;
    await (db as any).insert(evidenceFiles).values({
      id: record.id, reportId: record.reportId, objectiveId: record.objectiveId,
      userId: record.userId, fileName: record.fileName, originalName: record.originalName,
      fileSize: record.fileSize, mimeType: record.mimeType, content: record.content,
    });
    return;
  }
  const p = evidenceFilesPath(record.reportId);
  const all = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as EvidenceFileRecord[]) : [];
  all.push(record);
  writeFileSync(p, JSON.stringify(all, null, 2), "utf8");
}

async function deleteEvidenceFile(reportId: string, fileId: string): Promise<boolean> {
  if (db && dbSchema && drizzleOps) {
    const { evidenceFiles } = dbSchema as any;
    if (!evidenceFiles) return false;
    const { eq, and } = drizzleOps;
    await (db as any).delete(evidenceFiles).where(and(eq(evidenceFiles.id, fileId), eq(evidenceFiles.reportId, reportId)));
    return true;
  }
  const p = evidenceFilesPath(reportId);
  if (!existsSync(p)) return false;
  const all = JSON.parse(readFileSync(p, "utf8")) as EvidenceFileRecord[];
  const next = all.filter(f => f.id !== fileId);
  writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
  return next.length < all.length;
}

app.post("/api/reports/:id/objectives/:objId/files", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });

  const MAX_BYTES = 5 * 1024 * 1024;
  const chunks: Buffer[] = [];
  let totalSize = 0;

  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return void res.status(400).json({ error: "Expected multipart/form-data" });
  }

  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    chunks.push(chunk);
  });

  req.on("end", async () => {
    try {
      if (totalSize > MAX_BYTES + 8192) return res.status(413).json({ error: "File too large (max 5 MB)" });

      const body = Buffer.concat(chunks);
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (!boundaryMatch) return res.status(400).json({ error: "No boundary found" });
      const boundary = Buffer.from(`--${boundaryMatch[1]}`);

      const parts: Buffer[] = [];
      let pos = 0;
      while (pos < body.length) {
        const idx = body.indexOf(boundary, pos);
        if (idx === -1) break;
        const partStart = idx + boundary.length;
        if (body[partStart] === 0x2d && body[partStart + 1] === 0x2d) break;
        parts.push(body.slice(partStart));
        pos = partStart + 1;
      }

      let fileName = "upload";
      let mimeType = "application/octet-stream";
      let fileContent: Buffer | null = null;

      for (const part of parts) {
        const sep = part.indexOf(Buffer.from("\r\n\r\n"));
        if (sep === -1) continue;
        const header = part.slice(0, sep).toString("utf8");
        const bodyPart = part.slice(sep + 4);
        const endIdx = bodyPart.lastIndexOf("\r\n");
        const content = endIdx > 0 ? bodyPart.slice(0, endIdx) : bodyPart;
        if (header.includes("filename=")) {
          const nameMatch = header.match(/filename="?([^"\r\n]+)"?/);
          if (nameMatch) fileName = nameMatch[1];
          const ctMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
          if (ctMatch) mimeType = ctMatch[1].trim();
          fileContent = content;
        }
      }

      if (!fileContent) return res.status(400).json({ error: "No file found in upload" });

      const { randomUUID } = await import("crypto");
      const id = randomUUID();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._\-]/g, "_");

      const record: EvidenceFileRecord = {
        id, reportId: req.params.id,
        objectiveId: decodeURIComponent(req.params.objId),
        userId: req.userId ?? "unknown",
        fileName: safeFileName, originalName: fileName,
        fileSize: fileContent.length, mimeType,
        content: fileContent.toString("base64"),
        uploadedAt: new Date().toISOString(),
      };

      await saveEvidenceFile(record);
      res.json({ ok: true, file: { id, fileName: safeFileName, originalName: fileName, fileSize: fileContent.length, mimeType, uploadedAt: record.uploadedAt } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) res.status(500).json({ error: msg });
    }
  });
});

app.get("/api/reports/:id/objectives/:objId/files", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });
  const files = await loadEvidenceFiles(req.params.id, decodeURIComponent(req.params.objId));
  res.json(files.map(f => ({ id: f.id, fileName: f.fileName, originalName: f.originalName, fileSize: f.fileSize, mimeType: f.mimeType, uploadedAt: f.uploadedAt })));
});

app.delete("/api/reports/:id/objectives/:objId/files/:fileId", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });
  const deleted = await deleteEvidenceFile(req.params.id, req.params.fileId);
  res.json({ ok: deleted });
});

app.get("/api/reports/:id/objectives/:objId/files/:fileId/download", async (req: AuthedRequest, res) => {
  const report = await loadReport(req.params.id, req.userId);
  if (!report) return void res.status(404).json({ error: "Report not found" });
  const files = await loadEvidenceFiles(req.params.id);
  const file = files.find(f => f.id === req.params.fileId);
  if (!file) return void res.status(404).json({ error: "File not found" });
  const buffer = Buffer.from(file.content, "base64");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
  res.end(buffer);
});

// =============================================================================
// CONFIGURATION DRIFT DETECTION
// GET /api/reports/drift?frameworkId=CMMC_L2&clientId=xxx
// =============================================================================

app.get("/api/reports/drift", async (req: AuthedRequest, res) => {
  const { frameworkId, clientId } = req.query as { frameworkId?: string; clientId?: string };

  const allReports = await (async () => {
    if (db && dbSchema && drizzleOps) {
      const { reports: reportsTable } = dbSchema;
      const { eq, and, desc } = drizzleOps;
      const conds = [eq((reportsTable as any).userId, req.userId ?? "")];
      if (frameworkId) conds.push(eq((reportsTable as any).frameworkId, frameworkId));
      if (clientId)    conds.push(eq((reportsTable as any).clientId, clientId));
      const rows = await (db as any).select().from(reportsTable).where(and(...conds)).orderBy(desc((reportsTable as any).generatedAt)).limit(2);
      return rows.map((r: any) => r.data as ComplianceReport);
    }
    try {
      const { readdir } = await import("fs/promises");
      const files = (await readdir(REPORTS_DIR)).filter((f: string) => f.endsWith(".json"));
      const loaded = files.map((f: string) => {
        try { return JSON.parse(readFileSync(join(REPORTS_DIR, f), "utf8")) as ComplianceReport; } catch { return null; }
      }).filter((r: ComplianceReport | null): r is ComplianceReport => r !== null && (r as any).userId === req.userId);
      return loaded
        .filter((r: ComplianceReport) => (!frameworkId || r.frameworkId === frameworkId) && (!clientId || (r as any).clientId === clientId))
        .sort((a: ComplianceReport, b: ComplianceReport) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, 2);
    } catch { return []; }
  })();

  if (allReports.length < 2) {
    return void res.json({ hasDrift: false, message: "Need at least two assessments to detect drift.", reports: allReports.length });
  }

  const [latest, previous] = allReports as [ComplianceReport, ComplianceReport];
  const latestMap   = new Map(latest.controlAssessments.map(c => [c.controlId, c]));
  const previousMap = new Map(previous.controlAssessments.map(c => [c.controlId, c]));

  const changed: { controlId: string; controlName: string; from: string; to: string; direction: "improved" | "degraded" | "changed" }[] = [];

  for (const [id, curr] of latestMap) {
    const prev = previousMap.get(id);
    if (!prev || curr.status === prev.status) continue;
    const improved = (prev.status === "fail" && curr.status !== "fail") || (prev.status === "partial" && curr.status === "pass");
    const degraded = (curr.status === "fail" && prev.status !== "fail") || (curr.status === "partial" && prev.status === "pass");
    changed.push({ controlId: id, controlName: curr.controlTitle ?? id, from: prev.status, to: curr.status, direction: improved ? "improved" : degraded ? "degraded" : "changed" });
  }

  res.json({
    hasDrift: changed.length > 0,
    latestReport:   { id: latest.reportId,   score: latest.summary.compliancePercentage,   generatedAt: latest.generatedAt },
    previousReport: { id: previous.reportId, score: previous.summary.compliancePercentage, generatedAt: previous.generatedAt },
    scoreDelta: latest.summary.compliancePercentage - previous.summary.compliancePercentage,
    changed, improved: changed.filter(c => c.direction === "improved").length,
    degraded: changed.filter(c => c.direction === "degraded").length,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/profile", async (req: AuthedRequest, res: Response) => {
  if (db && dbSchema) {
    const { eq } = drizzleOps!;
    const rows = await db.select().from(dbSchema.userProfiles)
      .where(eq(dbSchema.userProfiles.userId, req.userId ?? "dev")).limit(1);
    if (rows.length > 0) return void res.json(rows[0]);
  }
  res.status(404).json({ error: "Profile not found" });
});

app.put("/api/profile", async (req: AuthedRequest, res: Response) => {
  const { companyName, accountType, role, orgSize, industry } = req.body as {
    companyName: string; accountType: string; role?: string; orgSize?: string; industry?: string;
  };
  if (!companyName || !accountType) return void res.status(400).json({ error: "companyName and accountType are required" });

  let savedProfile: Record<string, unknown>;
  if (db && dbSchema) {
    const { eq } = drizzleOps!;
    const rows = await db.insert(dbSchema.userProfiles)
      .values({ userId: req.userId ?? "dev", companyName, accountType, role, orgSize, industry })
      .onConflictDoUpdate({
        target: dbSchema.userProfiles.userId,
        set: { companyName, accountType, role, orgSize, industry },
      })
      .returning();
    savedProfile = rows[0] as Record<string, unknown>;
  } else {
    savedProfile = { userId: req.userId, companyName, accountType, role, orgSize, industry };
  }

  // Clerk publicMetadata (onboarded: true) is now set via the Next.js
  // /api/complete-onboarding route on Vercel — not here. Railway just saves to DB.
  return void res.json(savedProfile);
});

// Also add notes update to clients
app.put("/api/clients/:id/notes", async (req: AuthedRequest, res: Response) => {
  const { notes } = req.body as { notes: string };
  if (db && dbSchema) {
    const { eq, and } = drizzleOps!;
    await db.update(dbSchema.clients)
      .set({ notes })
      .where(and(eq(dbSchema.clients.id, req.params.id), eq(dbSchema.clients.userId, req.userId ?? "dev")));
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ASSET SCOPING
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/clients/:id/scoping", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  if (db && dbSchema) {
    const { eq } = drizzleOps!;
    const rows = await db.select().from(dbSchema.clientScoping)
      .where(eq(dbSchema.clientScoping.clientId, id)).limit(1);
    if (rows.length > 0) return void res.json(rows[0].scoping);
  }
  res.json({ cui: true, spa: true, iot: false, ot_scada: false });
});

app.put("/api/clients/:id/scoping", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const scoping = req.body;
  if (db && dbSchema) {
    const { eq } = drizzleOps!;
    await db.insert(dbSchema.clientScoping)
      .values({ clientId: id, userId: req.userId ?? "dev", scoping })
      .onConflictDoUpdate({ target: dbSchema.clientScoping.clientId, set: { scoping, updatedAt: new Date() } });
  }
  res.json({ ok: true, scoping });
});

// ═══════════════════════════════════════════════════════════════════════════
// CA EXCLUSION NUDGE
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/clients/:id/ca-exclusions", async (req: AuthedRequest, res: Response) => {
  try {
    const client = await getClient(req.params.id, req.userId ?? "dev");
    if (!client) return void res.status(404).json({ error: "Client not found" });

    const gc = makeGraphClient(client);
    const raw = await gc.query<any>("/policies/conditionalAccessPolicies", { select: ["id","displayName","conditions","state"], top: 100 });
    const policies = (raw?.value ?? []).filter((p: any) => {
      const u = p.conditions?.users ?? {};
      return (u.excludeUsers?.length ?? 0) > 0 || (u.excludeGroups?.length ?? 0) > 0;
    });

    // Load stored snapshots for diff
    let stored: Record<string, any> = {};
    if (db && dbSchema) {
      const { eq } = drizzleOps!;
      const rows = await db.select().from(dbSchema.caExclusionSnapshots)
        .where(eq(dbSchema.caExclusionSnapshots.clientId, req.params.id));
      for (const row of rows) stored[row.policyId] = row;
    }

    const results = policies.map((p: any) => {
      const u = p.conditions?.users ?? {};
      const excludedUsers  = u.excludeUsers  ?? [];
      const excludedGroups = u.excludeGroups ?? [];
      const prev = stored[p.id];
      const prevUsers  = prev?.excludedUsers  ?? [];
      const prevGroups = prev?.excludedGroups ?? [];
      const changed = JSON.stringify([...excludedUsers].sort()) !== JSON.stringify([...prevUsers].sort())
                   || JSON.stringify([...excludedGroups].sort()) !== JSON.stringify([...prevGroups].sort());
      return {
        policyId:      p.id,
        policyName:    p.displayName,
        state:         p.state,
        excludedUsers,
        excludedGroups,
        justification: prev?.justification ?? null,
        changed:       prev ? changed : false,
        scannedAt:     prev?.scannedAt ?? null,
      };
    });

    // Upsert snapshots
    if (db && dbSchema) {
      for (const r of results) {
        await db.insert(dbSchema.caExclusionSnapshots)
          .values({
            clientId: req.params.id, userId: req.userId ?? "dev",
            policyId: r.policyId, policyName: r.policyName,
            excludedUsers: r.excludedUsers, excludedGroups: r.excludedGroups,
            justification: stored[r.policyId]?.justification ?? null,
            changed: r.changed ? "yes" : "no", scannedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dbSchema.caExclusionSnapshots.clientId, dbSchema.caExclusionSnapshots.policyId],
            set: {
              policyName: r.policyName, excludedUsers: r.excludedUsers, excludedGroups: r.excludedGroups,
              changed: r.changed ? "yes" : "no", scannedAt: new Date(),
            },
          });
      }
    }

    res.json({ policies: results, total: results.length, withChanges: results.filter((r: any) => r.changed).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/clients/:id/ca-exclusions/:policyId/justify", async (req: AuthedRequest, res: Response) => {
  const { id, policyId } = req.params;
  const { justification } = req.body as { justification: string };
  if (db && dbSchema) {
    const { eq, and } = drizzleOps!;
    await db.update(dbSchema.caExclusionSnapshots)
      .set({ justification })
      .where(and(eq(dbSchema.caExclusionSnapshots.clientId, id), eq(dbSchema.caExclusionSnapshots.policyId, policyId)));
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ACCESS REVIEW PULL
// ═══════════════════════════════════════════════════════════════════════════

app.get("/api/clients/:id/access-reviews", async (req: AuthedRequest, res: Response) => {
  try {
    const client = await getClient(req.params.id, req.userId ?? "dev");
    if (!client) return void res.status(404).json({ error: "Client not found" });

    const gc = makeGraphClient(client);
    let definitions: any[] = [];
    try {
      const raw = await gc.query<any>("/identityGovernance/accessReviews/definitions", { select: ["id","displayName","scope","schedule","status"], top: 50 });
      definitions = raw?.value ?? [];
    } catch {
      return void res.json({ supported: false, message: "Access reviews require Entra ID P2 or Governance licensing.", definitions: [] });
    }

    const enriched = await Promise.all(definitions.map(async (d: any) => {
      let lastInstance: any = null;
      try {
        const inst = await gc.query<any>(`/identityGovernance/accessReviews/definitions/${d.id}/instances`, { select: ["id","startDateTime","endDateTime","status"], top: 1 });
        lastInstance = inst?.value?.[0] ?? null;
      } catch { /* ignore */ }

      const schedule     = d.schedule ?? {};
      const recurrenceType = schedule.recurrence?.pattern?.type ?? "none";
      const intervalDays = recurrenceType === "weekly" ? 7
                         : recurrenceType === "absoluteMonthly" ? 30
                         : recurrenceType === "absoluteYearly" ? 365 : null;

      const lastCompleted = lastInstance?.endDateTime ? new Date(lastInstance.endDateTime) : null;
      const daysSinceLast = lastCompleted ? Math.floor((Date.now() - lastCompleted.getTime()) / 86400000) : null;
      const overdue = intervalDays && daysSinceLast !== null ? daysSinceLast > intervalDays * 1.1 : false;

      return {
        id:             d.id,
        displayName:    d.displayName,
        status:         d.status,
        recurrenceType,
        intervalDays,
        lastInstance:   lastInstance ? { status: lastInstance.status, start: lastInstance.startDateTime, end: lastInstance.endDateTime } : null,
        daysSinceLast,
        overdue,
        onSchedule:     intervalDays ? !overdue : null,
      };
    }));

    const configured = enriched.length;
    const onSchedule = enriched.filter(d => d.onSchedule === true).length;
    const overdue    = enriched.filter(d => d.overdue).length;
    res.json({ supported: true, configured, onSchedule, overdue, definitions: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TICKET NOMINATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// NLP helper — simple token overlap → 0–100 confidence
function scoreTicketVsControl(ticketText: string, controlText: string): number {
  const STOP = new Set(["the","a","an","and","or","in","of","to","for","with","that","this","is","are","be","been","by","on","at","from","as","was","were","has","have","had","not","but","if","it","its","will","can","do","does","did","he","she","we","they","you","i","no","so","any","all","when","where","which","who","what","how","each","per","should","must","shall","may","then","than","about","into","over","under","more","also","only","after","before","during","since","while","other","new","up","out","off"]);
  const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const tSet = new Set(tokenize(ticketText));
  const cSet = new Set(tokenize(controlText));
  if (tSet.size === 0 || cSet.size === 0) return 0;
  let intersection = 0;
  for (const w of tSet) if (cSet.has(w)) intersection++;
  const union = new Set([...tSet, ...cSet]).size;
  return Math.round((intersection / union) * 100);
}

app.post("/api/clients/:id/tickets/scan", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  const { platform, frameworkId = "CMMC_L2", projectKey } = req.body as { platform: string; frameworkId?: string; projectKey?: string };

  try {
    // Get integration credentials
    let integConfig: any = null;
    if (db && dbSchema) {
      const { eq, and } = drizzleOps!;
      const rows = await db.select().from(dbSchema.clientIntegrations)
        .where(and(eq(dbSchema.clientIntegrations.clientId, id), eq(dbSchema.clientIntegrations.platform, platform)));
      integConfig = rows[0]?.config ?? null;
    }
    if (!integConfig) return void res.status(400).json({ error: `No ${platform} integration configured` });

    // Fetch tickets
    let tickets: Array<{ id: string; title: string; description: string; url: string }> = [];

    if (platform === "jira") {
      const { domain, email, apiToken } = integConfig as any;
      const jql = projectKey ? `project=${projectKey} ORDER BY created DESC` : "ORDER BY created DESC";
      const jiraRes = await fetch(`https://${domain}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,description`, {
        headers: { Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`, Accept: "application/json" },
      });
      if (!jiraRes.ok) return void res.status(400).json({ error: "Jira API error: " + await jiraRes.text() });
      const jiraData = await jiraRes.json() as any;
      tickets = (jiraData.issues ?? []).map((issue: any) => ({
        id:          issue.key,
        title:       issue.fields.summary ?? "",
        description: issue.fields.description?.content?.map((b: any) => b.content?.map((c: any) => c.text ?? "").join(" ")).join(" ") ?? "",
        url:         `https://${domain}/browse/${issue.key}`,
      }));
    } else if (platform === "servicenow") {
      const { instanceUrl, username, password } = integConfig as any;
      const snRes = await fetch(`${instanceUrl}/api/now/table/incident?sysparm_limit=50&sysparm_fields=number,short_description,description,sys_id`, {
        headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`, Accept: "application/json" },
      });
      if (!snRes.ok) return void res.status(400).json({ error: "ServiceNow API error: " + await snRes.text() });
      const snData = await snRes.json() as any;
      tickets = (snData.result ?? []).map((inc: any) => ({
        id:          inc.number,
        title:       inc.short_description ?? "",
        description: inc.description ?? "",
        url:         `${instanceUrl}/nav_to.do?uri=incident.do?sys_id=${inc.sys_id}`,
      }));
    } else {
      return void res.status(400).json({ error: "Unsupported platform" });
    }

    // Score each ticket against each control
    const controls = getFrameworkControls(frameworkId as any) ?? [];
    const nominations: any[] = [];
    const MIN_CONFIDENCE = 15;

    for (const ticket of tickets) {
      const ticketText = `${ticket.title} ${ticket.description}`;
      const scored = controls
        .map(ctrl => ({ ctrl, confidence: scoreTicketVsControl(ticketText, `${ctrl.title} ${ctrl.description}`) }))
        .filter(x => x.confidence >= MIN_CONFIDENCE)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      for (const { ctrl, confidence } of scored) {
        nominations.push({
          platform,
          ticketId:    ticket.id,
          ticketTitle: ticket.title,
          ticketUrl:   ticket.url,
          controlId:   ctrl.controlId,
          controlTitle: ctrl.title,
          frameworkId,
          confidence,
        });
      }
    }

    // Persist new nominations (skip duplicates)
    if (db && dbSchema) {
      const { eq, and } = drizzleOps!;
      for (const nom of nominations) {
        // Check if already exists
        const existing = await db.select({ id: dbSchema.ticketNominations.id })
          .from(dbSchema.ticketNominations)
          .where(and(
            eq(dbSchema.ticketNominations.clientId, id),
            eq(dbSchema.ticketNominations.ticketId, nom.ticketId),
            eq(dbSchema.ticketNominations.controlId, nom.controlId),
          )).limit(1);
        if (existing.length === 0) {
          await db.insert(dbSchema.ticketNominations).values({
            clientId: id, userId: req.userId ?? "dev", ...nom, status: "pending",
          });
        }
      }
    }

    res.json({ scanned: tickets.length, nominated: nominations.length, nominations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/clients/:id/tickets/nominations", async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  if (db && dbSchema) {
    const { eq } = drizzleOps!;
    const rows = await db.select().from(dbSchema.ticketNominations)
      .where(eq(dbSchema.ticketNominations.clientId, id))
      .orderBy(dbSchema.ticketNominations.createdAt);
    return void res.json(rows);
  }
  res.json([]);
});

app.put("/api/clients/:id/tickets/nominations/:nomId", async (req: AuthedRequest, res: Response) => {
  const { id, nomId } = req.params;
  const { status } = req.body as { status: "accepted" | "rejected" };
  if (db && dbSchema) {
    const { eq, and } = drizzleOps!;
    await db.update(dbSchema.ticketNominations)
      .set({ status })
      .where(and(eq(dbSchema.ticketNominations.id, nomId), eq(dbSchema.ticketNominations.clientId, id)));
  }
  res.json({ ok: true });
});

// ─── Clerk Webhook — user.deleted ─────────────────────────────────────────
// Registered BEFORE requireAuth so Clerk can POST to it without a Bearer token.
// Svix signature verification is used instead of Clerk JWT auth.
//
// Setup:
//  1. Go to Clerk Dashboard → Webhooks → Add endpoint
//  2. URL: https://your-app.vercel.app/api/webhooks/clerk
//  3. Events: select "user.deleted"
//  4. Copy the Signing Secret → set CLERK_WEBHOOK_SECRET in Railway env vars

app.post("/api/webhooks/clerk", async (req: any, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] CLERK_WEBHOOK_SECRET not set — skipping verification");
    return void res.status(400).json({ error: "Webhook secret not configured" });
  }

  // Verify Svix signature
  const wh = new Webhook(secret);
  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(req.rawBody as Buffer, {
      "svix-id":        req.headers["svix-id"]        as string,
      "svix-timestamp": req.headers["svix-timestamp"] as string,
      "svix-signature": req.headers["svix-signature"] as string,
    }) as typeof evt;
  } catch (err) {
    console.warn("[webhook] Invalid Svix signature:", (err as Error).message);
    return void res.status(400).json({ error: "Invalid signature" });
  }

  if (evt.type !== "user.deleted") {
    return void res.json({ received: true }); // ignore other events
  }

  const userId = evt.data.id as string | undefined;
  if (!userId) return void res.status(400).json({ error: "Missing user id in payload" });

  if (!db || !dbSchema || !drizzleOps) {
    console.warn("[webhook] DB not ready — cannot delete user data for", userId);
    return void res.status(503).json({ error: "Database not available" });
  }

  const { eq, or } = drizzleOps;
  const s = dbSchema;

  try {
    // Delete in dependency order so FK constraints are satisfied.
    // Most child tables have ON DELETE CASCADE from clients/reports, so
    // deleting the parent rows handles them automatically.

    // 1. Team memberships (bidirectional — user may be owner or member)
    await db.delete(s.teamMemberships)
      .where(or(eq(s.teamMemberships.ownerId, userId), eq(s.teamMemberships.memberId, userId)));

    // 2. Team invitations sent by this user
    await db.delete(s.teamInvitations).where(eq(s.teamInvitations.ownerId, userId));

    // 3. Client invitations created by this user
    await db.delete(s.clientInvitations).where(eq(s.clientInvitations.userId, userId));

    // 4. Reports (cascades → objective_statuses, evidence_files)
    await db.delete(s.reports).where(eq(s.reports.userId, userId));

    // 5. Clients (cascades → client_integrations, client_scoping,
    //             ca_exclusion_snapshots, ticket_nominations)
    await db.delete(s.clients).where(eq(s.clients.userId, userId));

    // 6. User profile
    await db.delete(s.userProfiles).where(eq(s.userProfiles.userId, userId));

    console.log(`[webhook] Deleted all platform data for user ${userId}`);
    res.json({ deleted: true, userId });
  } catch (err) {
    console.error("[webhook] Failed to delete user data:", err);
    res.status(500).json({ error: "Deletion failed" });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? "3001");

async function start() {
  // Initialize optional services before accepting requests
  await Promise.all([initDB(), initClerk()]);
  initEmail();

  app.listen(PORT, () => {
    void (async () => {
      const clients = await listClients();
      console.log(`\n[INDEX] Compliance API  →  http://localhost:${PORT}`);
      console.log(`[INDEX] Clients         →  ${clients.length} configured${clients.length ? ` (${clients.map(c => c.name).join(", ")})` : " — open http://localhost:3000/setup"}`);
      const anthropicKey = resolveAnthropicKey();
      console.log(`[INDEX] Anthropic API   →  ${anthropicKey ? "✓ key present" : "✗ key not found (set ANTHROPIC_API_KEY)"}`);
      if (!db) console.log(`[INDEX] Reports stored  →  ${REPORTS_DIR} (file mode)`);
      console.log("");
    })();
  });
}

start().catch((err) => { console.error("[INDEX] Fatal startup error:", err); process.exit(1); });
