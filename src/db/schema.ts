/**
 * INDEX — Drizzle ORM schema for Neon PostgreSQL
 *
 * Tables:
 *  - clients         : Azure tenant configurations per user (replaces web/.config/clients.json)
 *  - reports         : Compliance assessment reports (replaces web/.reports/*.json)
 *  - objective_statuses : DIBCAC 320 objective tracking (replaces web/.objectives/*.json)
 */

import {
  pgTable,
  text,
  jsonb,
  uuid,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ─── Clients (Azure tenants) ───────────────────────────────────────────────

export const clients = pgTable("clients", {
  /** UUID primary key */
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID — all clients are scoped to the owning user */
  userId: text("user_id").notNull(),

  /** Legacy slug / display name key used as external identifier */
  externalId: text("external_id").notNull(),

  /** Human-readable name for the organisation / tenant */
  name: text("name").notNull(),

  /** Azure Active Directory tenant ID (UUID) */
  tenantId: text("tenant_id").notNull(),

  /** Azure app registration client ID (UUID) */
  clientId: text("client_id").notNull(),

  /** Azure app registration client secret — stored as-is for now;
   *  TODO: encrypt at rest (Azure Key Vault reference) */
  clientSecret: text("client_secret").notNull(),

  addedAt: timestamp("added_at").defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

// ─── Reports ───────────────────────────────────────────────────────────────

export const reports = pgTable("reports", {
  /** Report ID in the format RPT-{timestamp} */
  id: text("id").primaryKey(),

  /** Clerk user ID — all reports are scoped to the owning user */
  userId: text("user_id").notNull(),

  /** FK to clients table (nullable — client may be deleted) */
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  /** Framework identifier: CMMC_L2, NIST_CSF, HIPAA, FINRA, FERPA, etc. */
  frameworkId: text("framework_id").notNull(),

  /** Full ComplianceReport object stored as JSONB */
  data: jsonb("data").notNull(),

  /** When the assessment was run */
  generatedAt: timestamp("generated_at").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

// ─── DIBCAC Objective Statuses ─────────────────────────────────────────────

export const objectiveStatuses = pgTable(
  "objective_statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to reports.id */
    reportId: text("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull(),

    /** DIBCAC objective identifier, e.g. "3.1.1[a]" */
    objectiveId: text("objective_id").notNull(),

    /** met | partially_met | not_met | not_assessed | requires_manual | requires_physical */
    status: text("status").notNull(),

    /** automated_graph | manual_attestation | document_upload | inherited_from_control | none */
    evidenceSource: text("evidence_source"),

    /** Free-text attestation provided by the assessor */
    attestationText: text("attestation_text"),

    /** Document reference / link */
    documentRef: text("document_ref"),

    /** Friendly document name */
    documentName: text("document_name"),

    assessedAt: timestamp("assessed_at"),

    /** Clerk user ID of the person who attested */
    assessedBy: text("assessed_by"),
  },
  (t) => ({
    /** Each objective can only appear once per report */
    uniqPerReport: unique().on(t.reportId, t.objectiveId),
  })
);

export type ObjectiveStatus = typeof objectiveStatuses.$inferSelect;
export type NewObjectiveStatus = typeof objectiveStatuses.$inferInsert;
