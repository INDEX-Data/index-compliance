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
  integer,
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
  notes: text("notes"),
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

// ─── User Profiles ─────────────────────────────────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  id:          uuid("id").defaultRandom().primaryKey(),
  userId:      text("user_id").notNull().unique(),
  /** 'org' = single organization, 'msp' = MSP/MSSP managing multiple clients */
  accountType: text("account_type").notNull().default("msp"), // 'org' | 'msp'
  companyName: text("company_name").notNull(),
  role:        text("role"),           // e.g. "CISO", "IT Manager", "Consultant"
  orgSize:     text("org_size"),       // e.g. "1-10", "11-50", "51-250", "251-1000", "1000+"
  industry:    text("industry"),       // e.g. "Defense", "Healthcare", "Finance"
  onboardedAt: timestamp("onboarded_at").defaultNow(),
});

export type UserProfile    = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// ─── Asset Scoping (per-client) ────────────────────────────────────────────

export const clientScoping = pgTable("client_scoping", {
  id:       uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull().unique(),
  userId:   text("user_id").notNull(),
  /** JSONB: { cui: bool, spa: bool, iot: bool, ot_scada: bool } */
  scoping:  jsonb("scoping").notNull().default({ cui: true, spa: true, iot: false, ot_scada: false }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ClientScoping    = typeof clientScoping.$inferSelect;
export type NewClientScoping = typeof clientScoping.$inferInsert;

// ─── CA Exclusion Snapshots ────────────────────────────────────────────────

export const caExclusionSnapshots = pgTable(
  "ca_exclusion_snapshots",
  {
    id:              uuid("id").defaultRandom().primaryKey(),
    clientId:        uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
    userId:          text("user_id").notNull(),
    policyId:        text("policy_id").notNull(),
    policyName:      text("policy_name").notNull(),
    excludedUsers:   jsonb("excluded_users").notNull().default([]),
    excludedGroups:  jsonb("excluded_groups").notNull().default([]),
    justification:   text("justification"),
    changed:         text("changed").notNull().default("no"), // "yes" | "no"
    scannedAt:       timestamp("scanned_at").defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.clientId, t.policyId) })
);

export type CaExclusionSnapshot    = typeof caExclusionSnapshots.$inferSelect;
export type NewCaExclusionSnapshot = typeof caExclusionSnapshots.$inferInsert;

// ─── Ticket Nominations ────────────────────────────────────────────────────

export const ticketNominations = pgTable("ticket_nominations", {
  id:           uuid("id").defaultRandom().primaryKey(),
  clientId:     uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  userId:       text("user_id").notNull(),
  platform:     text("platform").notNull(),   // "jira" | "servicenow"
  ticketId:     text("ticket_id").notNull(),
  ticketTitle:  text("ticket_title").notNull(),
  ticketUrl:    text("ticket_url"),
  controlId:    text("control_id").notNull(),
  controlTitle: text("control_title").notNull(),
  frameworkId:  text("framework_id").notNull(),
  confidence:   integer("confidence").notNull(), // 0–100
  /** pending | accepted | rejected */
  status:       text("status").notNull().default("pending"),
  createdAt:    timestamp("created_at").defaultNow(),
});

export type TicketNomination    = typeof ticketNominations.$inferSelect;
export type NewTicketNomination = typeof ticketNominations.$inferInsert;

// ─── Evidence Files ────────────────────────────────────────────────────────
// Files uploaded as evidence for a specific assessment objective.
// Content stored as base64-encoded text (max ~5 MB per file).

export const evidenceFiles = pgTable("evidence_files", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** FK to reports */
  reportId: text("report_id")
    .references(() => reports.id, { onDelete: "cascade" })
    .notNull(),

  /** Objective ID the file is attached to, e.g. "3.1.1[a]" */
  objectiveId: text("objective_id").notNull(),

  /** Clerk user ID who uploaded */
  userId: text("user_id").notNull(),

  /** Sanitised filename stored on server */
  fileName: text("file_name").notNull(),

  /** Original filename from the user's device */
  originalName: text("original_name").notNull(),

  /** File size in bytes */
  fileSize: integer("file_size").notNull(),

  /** MIME type */
  mimeType: text("mime_type").notNull(),

  /** Base64-encoded file content */
  content: text("content").notNull(),

  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type NewEvidenceFile = typeof evidenceFiles.$inferInsert;
