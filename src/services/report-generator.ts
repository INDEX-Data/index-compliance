// =============================================================================
// INDEX DSaaS — Word Document Report Generator
// Calls Claude AI for narrative analysis, then builds a professional .docx
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { ComplianceReport, ControlAssessment } from "../types.js";

// ── Color palette (no # prefix — docx requirement) ───────────────────────────
const C = {
  navy:       "0f172a",
  navyMid:    "1e3a5f",
  white:      "FFFFFF",
  passGreen:  "059669",
  passLight:  "d1fae5",
  amber:      "b45309",
  amberLight: "fef3c7",
  failRed:    "dc2626",
  failLight:  "fee2e2",
  slate:      "64748b",
  slateLight: "f1f5f9",
  body:       "1e293b",
  border:     "e2e8f0",
} as const;

// ── Status helpers ────────────────────────────────────────────────────────────

function statusFill(status: ControlAssessment["status"]): string {
  switch (status) {
    case "pass":          return C.passLight;
    case "partial":       return C.amberLight;
    case "fail":          return C.failLight;
    default:              return C.slateLight;
  }
}

function statusTextColor(status: ControlAssessment["status"]): string {
  switch (status) {
    case "pass":          return C.passGreen;
    case "partial":       return C.amber;
    case "fail":          return C.failRed;
    default:              return C.slate;
  }
}

function statusLabel(status: ControlAssessment["status"]): string {
  switch (status) {
    case "pass":            return "PASS";
    case "partial":         return "PARTIAL";
    case "fail":            return "FAIL";
    case "not_assessed":    return "NOT ASSESSED";
    case "not_applicable":  return "N/A";
    default:                return (status as string).toUpperCase();
  }
}

// ── Claude AI narrative generation ───────────────────────────────────────────

interface ReportNarrative {
  executiveSummary: string;
  riskNarrative: string;
  familyAnalysis: Record<string, string>;
  criticalFindingsNarrative: string;
  recommendations: Array<{
    priority: "Critical" | "High" | "Medium" | "Low";
    title: string;
    description: string;
    controlIds: string[];
  }>;
  conclusion: string;
}

async function generateNarrative(
  report: ComplianceReport,
  apiKey: string,
): Promise<ReportNarrative> {
  const { summary, controlAssessments, frameworkName, tenantDisplayName, generatedAt } = report;

  // Build per-family stats
  const familyStats: Record<string, { pass: number; partial: number; fail: number; na: number }> = {};
  for (const a of controlAssessments) {
    if (!familyStats[a.family]) familyStats[a.family] = { pass: 0, partial: 0, fail: 0, na: 0 };
    const f = familyStats[a.family];
    if      (a.status === "pass")    f.pass++;
    else if (a.status === "partial") f.partial++;
    else if (a.status === "fail")    f.fail++;
    else                             f.na++;
  }

  // Only send failed / partial controls to Claude (keeps prompt size manageable)
  const issueControls = controlAssessments
    .filter(a => a.status === "fail" || a.status === "partial")
    .map(a => ({
      controlId:       a.controlId,
      title:           a.controlTitle,
      family:          a.family,
      status:          a.status,
      findings:        a.findings.slice(0, 3),
      recommendations: a.recommendations.slice(0, 3),
    }));

  const familyLines = Object.entries(familyStats)
    .map(([f, c]) => `  ${f}: ${c.pass} pass, ${c.partial} partial, ${c.fail} fail, ${c.na} not assessed`)
    .join("\n");

  const dateStr = new Date(generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const prompt = `You are a senior cybersecurity compliance analyst generating a professional compliance gap assessment report for an executive audience.

ASSESSMENT DETAILS
- Organization: ${tenantDisplayName}
- Framework: ${frameworkName}
- Assessment Date: ${dateStr}
- Compliance Score: ${summary.compliancePercentage}%
- Risk Level: ${summary.riskScore.toUpperCase()}

COMPLIANCE SUMMARY
- Total Controls: ${summary.totalControls}
- Passed: ${summary.passed} (${Math.round((summary.passed / summary.totalControls) * 100)}%)
- Partial Compliance: ${summary.partial} (${Math.round((summary.partial / summary.totalControls) * 100)}%)
- Failed: ${summary.failed} (${Math.round((summary.failed / summary.totalControls) * 100)}%)
- Not Assessed: ${summary.notAssessed} (${Math.round((summary.notAssessed / summary.totalControls) * 100)}%)

CONTROL FAMILY BREAKDOWN
${familyLines}

CONTROLS REQUIRING ATTENTION (${issueControls.length} controls)
${JSON.stringify(issueControls, null, 2)}

Generate a professional, authoritative compliance report narrative. Write for a C-suite and compliance officer audience. Be specific about findings. Do NOT fabricate data beyond what is provided.

Return ONLY valid JSON matching this exact schema:
{
  "executiveSummary": "<3-4 paragraph executive summary: overall compliance posture, key risk areas, business implications, immediate priorities>",
  "riskNarrative": "<1-2 paragraphs on specific risk implications of the compliance gaps and potential regulatory/operational exposure>",
  "familyAnalysis": {
    "<Family Name>": "<1-2 sentence targeted analysis for each family that has partial or failed controls>"
  },
  "criticalFindingsNarrative": "<2-3 paragraphs describing the most critical gaps, root cause patterns, and potential impact>",
  "recommendations": [
    {
      "priority": "Critical",
      "title": "<Short imperative action title, e.g., Enable MFA for All Privileged Accounts>",
      "description": "<Specific, actionable recommendation with implementation guidance and business justification>",
      "controlIds": ["<control IDs this recommendation addresses>"]
    }
  ],
  "conclusion": "<1-2 paragraphs with positive framing, path forward, and commitment to continuous improvement>"
}

For recommendations: provide 5-8 items across Critical/High/Medium/Low priorities. Focus on highest-impact remediation. Include only families with familyAnalysis entries that have actual issues.`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model:      "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  });

  // Claude 4 models may return thinking blocks before the text block — find the text block explicitly
  const content = message.content.find(b => b.type === "text");
  if (!content || content.type !== "text") throw new Error("No text block in Claude response");

  // Extract JSON — strip markdown code fences if the model wrapped the response
  const raw = content.text.trim();
  const jsonText = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    : raw;

  return JSON.parse(jsonText) as ReportNarrative;
}

// ── Document element helpers ──────────────────────────────────────────────────

/** Convert pt values to twips (1 pt = 20 twips) */
function pt(before = 0, after = 0) {
  return { before: before * 20, after: after * 20 };
}

function heading1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: C.navy, size: 36, font: "Calibri" })],
    spacing: pt(14, 6),
    border: {
      bottom: { color: C.border, size: 4, space: 6, style: BorderStyle.SINGLE },
    },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: C.navyMid, size: 28, font: "Calibri" })],
    spacing: pt(10, 4),
  });
}

function bodyPara(text: string, afterPt = 6): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, color: C.body, size: 22, font: "Calibri" })],
    spacing: pt(0, afterPt),
  });
}

function indentedPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, color: C.body, size: 20, font: "Calibri" })],
    indent:  { left: convertInchesToTwip(0.25) },
    spacing: pt(0, 6),
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function emptyLine(afterPt = 6): Paragraph {
  return new Paragraph({ text: "", spacing: pt(0, afterPt) });
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function thCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    ...(widthPct !== undefined && { width: { size: widthPct, type: WidthType.PERCENTAGE } }),
    shading: { type: ShadingType.CLEAR, color: "auto", fill: C.navyMid },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: C.white, size: 18, font: "Calibri" })],
    })],
  });
}

function tdCell(
  text: string,
  opts: { fill?: string; color?: string; bold?: boolean; widthPct?: number } = {},
): TableCell {
  const { fill = C.white, color = C.body, bold = false, widthPct } = opts;
  return new TableCell({
    ...(widthPct !== undefined && { width: { size: widthPct, type: WidthType.PERCENTAGE } }),
    shading: { type: ShadingType.CLEAR, color: "auto", fill },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, color, size: 18, font: "Calibri" })],
    })],
  });
}

const tableBorders = {
  top:              { style: BorderStyle.SINGLE, size: 1, color: C.border },
  bottom:           { style: BorderStyle.SINGLE, size: 1, color: C.border },
  left:             { style: BorderStyle.SINGLE, size: 1, color: C.border },
  right:            { style: BorderStyle.SINGLE, size: 1, color: C.border },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: C.border },
  insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: C.border },
};

function makeTable(rows: TableRow[]): Table {
  return new Table({
    width:   { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows,
  });
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildCoverPage(report: ComplianceReport): Paragraph[] {
  const riskColorMap: Record<string, string> = {
    low: C.passGreen, medium: C.amber, high: "c2410c", critical: C.failRed,
  };
  const riskColor = riskColorMap[report.summary.riskScore] ?? C.failRed;
  const dateStr   = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return [
    new Paragraph({ text: "", spacing: pt(30, 0) }),

    // Branding
    new Paragraph({
      children: [new TextRun({ text: "INDEX DSaaS", bold: true, color: C.navy, size: 56, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 2),
    }),
    new Paragraph({
      children: [new TextRun({ text: "Compliance Assessment Platform", color: C.slate, size: 24, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 16),
    }),

    // Divider
    new Paragraph({
      border:   { bottom: { color: C.navyMid, size: 8, space: 10, style: BorderStyle.SINGLE } },
      spacing:  pt(0, 10),
      text:     "",
    }),

    // Report title
    new Paragraph({
      children: [new TextRun({ text: report.frameworkName, bold: true, color: C.navy, size: 64, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing:   pt(12, 4),
    }),
    new Paragraph({
      children: [new TextRun({ text: "COMPLIANCE GAP ASSESSMENT", bold: true, color: C.navyMid, size: 36, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 16),
    }),

    // Divider
    new Paragraph({
      border:  { bottom: { color: C.navyMid, size: 8, space: 10, style: BorderStyle.SINGLE } },
      spacing: pt(0, 14),
      text:    "",
    }),

    // Metadata lines
    new Paragraph({
      children: [
        new TextRun({ text: "Prepared for:   ", bold: true, color: C.slate, size: 24, font: "Calibri" }),
        new TextRun({ text: report.tenantDisplayName,         color: C.body,  size: 24, font: "Calibri" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 4),
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Assessment Date:   ", bold: true, color: C.slate, size: 24, font: "Calibri" }),
        new TextRun({ text: dateStr,                           color: C.body,  size: 24, font: "Calibri" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 4),
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Report ID:   ", bold: true, color: C.slate,  size: 22, font: "Calibri" }),
        new TextRun({ text: report.reportId,    color: C.body,  size: 20, font: "Courier New" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 14),
    }),

    // Risk / score callout
    new Paragraph({
      children: [
        new TextRun({ text: `  RISK RATING: ${report.summary.riskScore.toUpperCase()}  `, bold: true, color: riskColor,  size: 32, font: "Calibri" }),
        new TextRun({ text: `    COMPLIANCE SCORE: ${report.summary.compliancePercentage}%  `,  bold: true, color: C.navyMid, size: 32, font: "Calibri" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 18),
    }),

    // Classification
    new Paragraph({
      children: [new TextRun({ text: "CONFIDENTIAL — FOR AUTHORIZED USE ONLY", bold: true, color: C.failRed, size: 20, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing:   pt(0, 4),
    }),
    new Paragraph({
      children: [new TextRun({ text: "Generated by INDEX DSaaS + Claude AI", color: C.slate, size: 18, font: "Calibri", italics: true })],
      alignment: AlignmentType.CENTER,
    }),

    pageBreak(),
  ];
}

function buildExecutiveSummary(narrative: ReportNarrative): Paragraph[] {
  return [
    heading1("Executive Summary"),
    ...narrative.executiveSummary
      .split(/\n\n+/)
      .filter(Boolean)
      .map(p => bodyPara(p.trim(), 8)),
    pageBreak(),
  ];
}

function buildMetricsSection(report: ComplianceReport): (Paragraph | Table)[] {
  const { summary, controlAssessments } = report;

  // Family breakdown table
  const fam: Record<string, { pass: number; partial: number; fail: number; na: number; total: number }> = {};
  for (const a of controlAssessments) {
    if (!fam[a.family]) fam[a.family] = { pass: 0, partial: 0, fail: 0, na: 0, total: 0 };
    const f = fam[a.family];
    f.total++;
    if      (a.status === "pass")    f.pass++;
    else if (a.status === "partial") f.partial++;
    else if (a.status === "fail")    f.fail++;
    else                             f.na++;
  }

  const pct = (n: number) => `${n}  (${Math.round((n / summary.totalControls) * 100)}%)`;

  const overallTable = makeTable([
    new TableRow({
      tableHeader: true,
      children: [thCell("Metric", 45), thCell("Count", 25), thCell("Notes", 30)],
    }),
    new TableRow({ children: [
      tdCell("Total Controls",      { fill: C.slateLight }),
      tdCell(String(summary.totalControls), { fill: C.slateLight, bold: true }),
      tdCell("All controls assessed in this report", { fill: C.slateLight }),
    ]}),
    new TableRow({ children: [
      tdCell("Passed"),
      tdCell(pct(summary.passed),  { color: C.passGreen, bold: true }),
      tdCell("Controls meeting all requirements"),
    ]}),
    new TableRow({ children: [
      tdCell("Partial Compliance", { fill: C.slateLight }),
      tdCell(pct(summary.partial), { fill: C.slateLight, color: C.amber, bold: true }),
      tdCell("Controls partially meeting requirements", { fill: C.slateLight }),
    ]}),
    new TableRow({ children: [
      tdCell("Failed"),
      tdCell(pct(summary.failed),  { color: C.failRed, bold: true }),
      tdCell("Controls not meeting requirements"),
    ]}),
    new TableRow({ children: [
      tdCell("Not Assessed",       { fill: C.slateLight }),
      tdCell(pct(summary.notAssessed), { fill: C.slateLight }),
      tdCell("Require manual verification", { fill: C.slateLight }),
    ]}),
    new TableRow({ children: [
      tdCell("Compliance Score",   { fill: C.navyMid, color: C.white, bold: true }),
      tdCell(`${summary.compliancePercentage}%`, { fill: C.navyMid, color: C.white, bold: true }),
      tdCell(`Risk Level: ${summary.riskScore.toUpperCase()}`, { fill: C.navyMid, color: C.white, bold: true }),
    ]}),
  ]);

  const familyRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        thCell("Control Family", 30),
        thCell("Total",   14),
        thCell("Pass",    14),
        thCell("Partial", 14),
        thCell("Fail",    14),
        thCell("N/A",     14),
      ],
    }),
    ...Object.entries(fam)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([family, c], i) => {
        const fill = i % 2 === 0 ? C.white : C.slateLight;
        return new TableRow({ children: [
          tdCell(family,         { fill }),
          tdCell(String(c.total),  { fill, bold: true }),
          tdCell(String(c.pass),   { fill, color: c.pass    > 0 ? C.passGreen : C.body }),
          tdCell(String(c.partial),{ fill, color: c.partial > 0 ? C.amber     : C.body }),
          tdCell(String(c.fail),   { fill, color: c.fail    > 0 ? C.failRed   : C.body }),
          tdCell(String(c.na),     { fill, color: C.slate }),
        ]});
      }),
  ];

  return [
    heading1("Compliance Metrics"),
    heading2("Overall Assessment Results"),
    overallTable,
    emptyLine(8),
    heading2("Control Family Breakdown"),
    makeTable(familyRows),
    pageBreak(),
  ];
}

function buildRiskSection(narrative: ReportNarrative): Paragraph[] {
  return [
    heading1("Risk Assessment"),
    ...narrative.riskNarrative.split(/\n\n+/).filter(Boolean).map(p => bodyPara(p.trim(), 8)),
    emptyLine(4),
    heading2("Critical Findings Analysis"),
    ...narrative.criticalFindingsNarrative.split(/\n\n+/).filter(Boolean).map(p => bodyPara(p.trim(), 8)),
    pageBreak(),
  ];
}

function buildFamilyAnalysis(
  report: ComplianceReport,
  narrative: ReportNarrative,
): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [heading1("Control Family Analysis")];

  const byFamily: Record<string, ControlAssessment[]> = {};
  for (const a of report.controlAssessments) {
    if (!byFamily[a.family]) byFamily[a.family] = [];
    byFamily[a.family].push(a);
  }

  for (const family of Object.keys(byFamily).sort()) {
    const assessments = byFamily[family];
    const pass    = assessments.filter(a => a.status === "pass").length;
    const partial = assessments.filter(a => a.status === "partial").length;
    const fail    = assessments.filter(a => a.status === "fail").length;
    const na      = assessments.length - pass - partial - fail;

    children.push(heading2(family));

    // AI-generated family analysis (only shown if provided)
    const aiText = narrative.familyAnalysis?.[family];
    if (aiText) children.push(bodyPara(aiText.trim(), 6));

    // Stats summary line
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${assessments.length} controls  •  `, size: 20, font: "Calibri", color: C.slate }),
        new TextRun({ text: `${pass} pass  `,    size: 20, font: "Calibri", color: C.passGreen, bold: true }),
        new TextRun({ text: `${partial} partial  `, size: 20, font: "Calibri", color: C.amber,    bold: true }),
        new TextRun({ text: `${fail} fail`,     size: 20, font: "Calibri", color: C.failRed,  bold: true }),
        ...(na > 0 ? [new TextRun({ text: `  ${na} not assessed`, size: 20, font: "Calibri", color: C.slate })] : []),
      ],
      spacing: pt(0, 6),
    }));

    // Table of controls with issues
    const issueControls = assessments.filter(a => a.status === "fail" || a.status === "partial");
    if (issueControls.length > 0) {
      children.push(makeTable([
        new TableRow({
          tableHeader: true,
          children: [
            thCell("Control ID", 14),
            thCell("Title",      32),
            thCell("Status",     13),
            thCell("Key Finding", 41),
          ],
        }),
        ...issueControls.map((a, i) => {
          const rowFill = i % 2 === 0 ? C.white : C.slateLight;
          return new TableRow({ children: [
            tdCell(a.controlId,    { fill: rowFill }),
            tdCell(a.controlTitle, { fill: rowFill }),
            tdCell(statusLabel(a.status), { fill: statusFill(a.status), color: statusTextColor(a.status), bold: true }),
            tdCell(a.findings[0] ?? "—", { fill: rowFill }),
          ]});
        }),
      ]));
    }

    children.push(emptyLine(6));
  }

  children.push(pageBreak());
  return children;
}

function buildRecommendations(narrative: ReportNarrative): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [heading1("Prioritized Recommendations")];

  const priorityColors: Record<string, string> = {
    Critical: C.failRed, High: "c2410c", Medium: C.amber, Low: C.passGreen,
  };

  const grouped = (["Critical", "High", "Medium", "Low"] as const).map(p => ({
    priority: p,
    items: narrative.recommendations?.filter(r => r.priority === p) ?? [],
  })).filter(g => g.items.length > 0);

  for (const { priority, items } of grouped) {
    children.push(heading2(`${priority} Priority`));

    for (const rec of items) {
      // Title line with priority bullet
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "●  ", bold: true, color: priorityColors[priority] ?? C.navy, size: 22, font: "Calibri" }),
          new TextRun({ text: rec.title, bold: true, color: C.body, size: 22, font: "Calibri" }),
          ...(rec.controlIds?.length
            ? [new TextRun({ text: `   [${rec.controlIds.join(", ")}]`, color: C.slate, size: 18, font: "Calibri" })]
            : []),
        ],
        spacing: pt(4, 2),
      }));
      // Description
      children.push(indentedPara(rec.description));
    }
  }

  children.push(pageBreak());
  return children;
}

function buildConclusion(narrative: ReportNarrative): Paragraph[] {
  return [
    heading1("Conclusion"),
    ...narrative.conclusion.split(/\n\n+/).filter(Boolean).map(p => bodyPara(p.trim(), 8)),
    pageBreak(),
  ];
}

function buildAppendix(report: ComplianceReport): (Paragraph | Table)[] {
  return [
    heading1("Appendix A — Complete Control Assessment"),
    bodyPara("The following table lists every control evaluated in this assessment with its status and primary finding.", 8),
    makeTable([
      new TableRow({
        tableHeader: true,
        children: [
          thCell("Control ID",  13),
          thCell("Family",      20),
          thCell("Title",       29),
          thCell("Status",      12),
          thCell("Finding",     26),
        ],
      }),
      ...report.controlAssessments.map((a, i) => {
        const fill = i % 2 === 0 ? C.white : C.slateLight;
        return new TableRow({ children: [
          tdCell(a.controlId,    { fill }),
          tdCell(a.family,       { fill }),
          tdCell(a.controlTitle, { fill }),
          tdCell(statusLabel(a.status), {
            fill:  statusFill(a.status),
            color: statusTextColor(a.status),
            bold:  true,
          }),
          tdCell(a.findings[0] ?? "—", { fill }),
        ]});
      }),
    ]),
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateWordReport(
  report:          ComplianceReport,
  anthropicApiKey: string,
  onProgress?:     (msg: string) => void,
): Promise<Buffer> {
  onProgress?.("Calling Claude AI to analyze assessment results…");
  const narrative = await generateNarrative(report, anthropicApiKey);

  onProgress?.("Building Word document…");

  const mainHeader = new Header({
    children: [new Paragraph({
      children: [
        new TextRun({ text: "CONFIDENTIAL", bold: true, color: C.failRed, size: 18, font: "Calibri" }),
        new TextRun({ text: "    |    ",  color: C.border, size: 18, font: "Calibri" }),
        new TextRun({ text: `${report.frameworkName} Compliance Assessment`, color: C.slate, size: 18, font: "Calibri" }),
        new TextRun({ text: `    |    ${report.tenantDisplayName}`, color: C.slate, size: 18, font: "Calibri" }),
      ],
      alignment: AlignmentType.RIGHT,
    })],
  });

  const mainFooter = new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: "INDEX DSaaS  |  Compliance Assessment Platform    |    Page ", color: C.slate, size: 16, font: "Calibri" }),
        new TextRun({ children: [PageNumber.CURRENT], color: C.slate, size: 16, font: "Calibri" }),
        new TextRun({ text: " of ", color: C.slate, size: 16, font: "Calibri" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], color: C.slate, size: 16, font: "Calibri" }),
      ],
      alignment: AlignmentType.CENTER,
      border: { top: { color: C.border, size: 4, space: 6, style: BorderStyle.SINGLE } },
    })],
  });

  const coverChildren    = buildCoverPage(report);
  const mainChildren: (Paragraph | Table)[] = [
    ...buildExecutiveSummary(narrative),
    ...buildMetricsSection(report),
    ...buildRiskSection(narrative),
    ...buildFamilyAnalysis(report, narrative),
    ...buildRecommendations(narrative),
    ...buildConclusion(narrative),
    ...buildAppendix(report),
  ];

  const pageMargin = {
    top:    convertInchesToTwip(1),
    right:  convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left:   convertInchesToTwip(1.25),
  };

  const doc = new Document({
    title:       `${report.frameworkName} Compliance Gap Assessment`,
    creator:     "INDEX DSaaS Compliance Platform",
    description: `Compliance gap assessment for ${report.tenantDisplayName}`,
    sections: [
      // Cover page — no header / footer
      {
        properties: { page: { margin: pageMargin } },
        children:   coverChildren,
      },
      // Main content — with header + footer + page numbers
      {
        properties: { page: { margin: pageMargin } },
        headers:    { default: mainHeader },
        footers:    { default: mainFooter },
        children:   mainChildren,
      },
    ],
  });

  onProgress?.("Finalising document…");
  return Packer.toBuffer(doc);
}
