/**
 * INDEX — Drizzle ORM schema for Neon PostgreSQL
 *
 * Tables:
 *  - clients              : Azure tenant configurations per user
 *  - reports              : Compliance assessment reports
 *  - objective_statuses   : DIBCAC 320 objective tracking
 *  - client_invitations   : Tokenized invite links MSPs send to clients
 *  - client_integrations  : Per-client third-party platform credentials
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

// ─── Client Invitations ────────────────────────────────────────────────────

export const clientInvitations = pgTable("client_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID of the MSP who created the invite */
  userId: text("user_id").notNull(),

  /** FK to clients table — set once the client completes onboarding */
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),

  /** UUID token embedded in the public /onboard/:token URL */
  token: text("token").notNull().unique(),

  /** Pre-filled company name shown to the client */
  clientName: text("client_name").notNull(),

  /** Optional: who the invite was addressed to */
  email: text("email"),

  /** pending | accepted | revoked */
  status: text("status").notNull().default("pending"),

  createdAt: timestamp("created_at").defaultNow(),

  /** Link expires 3 days after creation */
  expiresAt: timestamp("expires_at").notNull(),
});

export type ClientInvitation = typeof clientInvitations.$inferSelect;
export type NewClientInvitation = typeof clientInvitations.$inferInsert;

// ─── Client Integrations ───────────────────────────────────────────────────

export const clientIntegrations = pgTable(
  "client_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to clients table */
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "cascade" })
      .notNull(),

    /** Clerk user ID of the owning MSP */
    userId: text("user_id").notNull(),

    /**
     * Platform identifier — one of:
     * entra_id | servicenow | splunk | jira | slack | teams |
     * workday | monday | box | dropbox
     */
    platform: text("platform").notNull(),

    /** Platform-specific credentials (API keys, URLs, tokens, etc.) */
    config: jsonb("config").notNull(),

    /** connected | error | pending */
    status: text("status").notNull().default("pending"),

    connectedAt: timestamp("connected_at"),
    lastTestedAt: timestamp("last_tested_at"),
    errorMessage: text("error_message"),
  },
  (t) => ({
    /** Each platform can only appear once per client */
    uniqPerClient: unique().on(t.clientId, t.platform),
  })
);

export type ClientIntegration = typeof clientIntegrations.$inferSelect;
export type NewClientIntegration = typeof clientIntegrations.$inferInsert;

// ─── Team Invitations ──────────────────────────────────────────────────────

export const teamInvitations = pgTable("team_invitations", {
  id:        uuid("id").defaultRandom().primaryKey(),

  /** Clerk user ID of the user who created the invite (whose clients are shared) */
  ownerId:   text("owner_id").notNull(),

  /** Email address the invite was sent to */
  email:     text("email").notNull(),

  /** UUID token embedded in the public /join/:token URL */
  token:     text("token").notNull().unique(),

  /** pending | accepted | revoked */
  status:    text("status").notNull().default("pending"),

  createdAt: timestamp("created_at").defaultNow(),

  /** Link expires 7 days after creation */
  expiresAt: timestamp("expires_at").notNull(),
});

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;

// ─── Team Memberships ─────────────────────────────────────────────────────

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id:           uuid("id").defaultRandom().primaryKey(),

    /** The user whose clients are being shared (the inviter) */
    ownerId:      text("owner_id").notNull(),

    /** The colleague who was granted access (the invitee) */
    memberId:     text("member_id").notNull(),

    /** FK to the invitation that created this membership */
    invitationId: uuid("invitation_id").references(() => teamInvitations.id, {
      onDelete: "set null",
    }),

    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({
    /** Each (owner, member) pair can only appear once */
    uniq: unique().on(t.ownerId, t.memberId),
  })
);

export type TeamMembership = typeof teamMemberships.$inferSelect;
export type NewTeamMembership = typeof teamMemberships.$inferInsert;
