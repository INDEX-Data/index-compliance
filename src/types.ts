// =============================================================================
// INDEX DSaaS - Microsoft Graph Compliance MCP Server
// Type Definitions
// =============================================================================

// ---------------------------------------------------------------------------
// Compliance Framework Types
// ---------------------------------------------------------------------------

export type FrameworkId =
  | 'BASELINE'
  | 'CMMC_L2'
  | 'NIST_800_171'
  | 'HIPAA'
  | 'FINRA'
  | 'FERPA'
  | 'NIST_CSF'
  | 'SOC2'
  | 'ISO_27001'
  | 'PCI_DSS'
  | 'GDPR'
  | 'HITRUST'
  | 'FDA'
  | 'NYDFS_NYCRR_500'
  | 'SEC'
  | 'ISO_27017'
  | 'CIS_CONTROLS'
  | 'MVSP'
  | 'AI_READINESS'

export interface ComplianceFramework {
  id: FrameworkId
  name: string
  version: string
  description: string
  controlFamilies: ControlFamily[]
}

export interface ControlFamily {
  id: string
  name: string
  description: string
  controls: ComplianceControl[]
}

export interface ComplianceControl {
  controlId: string
  title: string
  description: string
  frameworkId: FrameworkId
  family: string
  evidenceQueries: EvidenceQuery[]
  evaluationCriteria: EvaluationCriteria
}

// ---------------------------------------------------------------------------
// Evidence Query Types (maps controls to Graph API calls)
// ---------------------------------------------------------------------------

export type GraphEndpointCategory =
  | 'conditionalAccess'
  | 'sensitivityLabels'
  | 'dlpPolicies'
  | 'auditLog'
  | 'deviceCompliance'
  | 'deviceConfiguration'
  | 'identityProtection'
  | 'informationProtection'
  | 'retentionPolicies'
  | 'encryptionPolicies'
  | 'roleAssignments'
  | 'authenticationMethods'
  | 'sharePoint'

export interface EvidenceQuery {
  id: string
  description: string
  endpoint: string
  method: 'GET' | 'POST'
  category: GraphEndpointCategory
  requiredPermissions: string[]
  selectFields?: string[]
  filterExpression?: string
  expandFields?: string[]
  transformFn?: string // Name of a registered transform function
  apiVersion?: 'v1' | 'beta'
  topN?: number // Limit records fetched (defaults to Graph page size)
}

export interface EvaluationCriteria {
  type: 'boolean' | 'threshold' | 'exists' | 'contains' | 'custom'
  /** For boolean: field path that must be true */
  field?: string
  /** For threshold: minimum value */
  minimumValue?: number
  /** For contains: values that must be present */
  requiredValues?: string[]
  /** Human-readable description of what passing looks like */
  passingCondition: string
  /** Custom evaluation function name */
  customEvaluator?: string
}

// ---------------------------------------------------------------------------
// Assessment Result Types
// ---------------------------------------------------------------------------

/**
 * Control evaluation status.
 *  pass / fail / partial — control was automatically assessed and a verdict reached.
 *  manual_required       — control is inherently organizational / procedural / physical
 *                          and cannot be evidenced automatically; needs human attestation.
 *                          (Distinct from not_assessed: this is expected, not a failure.)
 *  not_assessed          — an automated check exists but evidence COLLECTION FAILED this run
 *                          (missing permission, API error, connector down). A gap to fix.
 *  not_applicable        — control is out of scope for this organization.
 */
export type ComplianceStatus =
  | 'pass'
  | 'fail'
  | 'partial'
  | 'manual_required'
  | 'not_assessed'
  | 'not_applicable'

export interface ControlAssessment {
  controlId: string
  controlTitle: string
  frameworkId: FrameworkId
  family: string
  status: ComplianceStatus
  evidenceCollected: EvidenceResult[]
  findings: string[]
  recommendations: string[]
  assessedAt: string // ISO 8601
}

export interface EvidenceResult {
  queryId: string
  queryDescription: string
  endpoint: string
  rawData: unknown[]
  recordCount: number
  collectedAt: string // ISO 8601
  success: boolean
  errorMessage?: string
}

export interface ComplianceReport {
  reportId: string
  tenantId: string
  tenantDisplayName: string
  frameworkId: FrameworkId
  frameworkName: string
  generatedAt: string // ISO 8601
  generatedBy: string
  summary: ComplianceSummary
  controlAssessments: ControlAssessment[]
  // Multi-tenant: internal client reference
  clientId?: string
  clientName?: string
}

/** Full report including DIBCAC 320 objective mapping — produced by runAssessment() */
export type FullReport = ComplianceReport & {
  objectiveStatuses: ObjectiveStatus[]
  dibcacSummary: DIBCACObjectiveSummary
}

// ---------------------------------------------------------------------------
// DIBCAC 320 Objective Tracking
// ---------------------------------------------------------------------------

/**
 * How INDEX satisfies this objective:
 *  met                — fully satisfied (automated Graph API evidence or manual attestation)
 *  partially_met      — partially satisfied (evidence exists but gaps remain)
 *  not_met            — objective is not satisfied
 *  not_assessed       — not yet evaluated
 *  requires_manual    — Document/Artifact type requiring human upload or attestation
 *  requires_physical  — Physical Review type; requires on-site DIBCAC inspection
 */
export type ObjectiveStatusValue =
  | 'met'
  | 'partially_met'
  | 'not_met'
  | 'not_assessed'
  | 'requires_manual'
  | 'requires_physical'

export type ObjectiveEvidenceSource =
  | 'automated_graph'
  | 'manual_attestation'
  | 'document_upload'
  | 'inherited_from_control'
  | 'none'

export interface ObjectiveStatus {
  objectiveId: string
  status: ObjectiveStatusValue
  evidenceSource: ObjectiveEvidenceSource
  /** Human-provided attestation text */
  attestationText?: string
  /** Reference to an uploaded document filename */
  documentRef?: string
  /** Display name for the document */
  documentName?: string
  assessedAt?: string
  /** Who set the status (e.g. "automated", user email) */
  assessedBy?: string
}

export interface DIBCACObjectiveSummary {
  total: number
  met: number
  partiallyMet: number
  notMet: number
  requiresManual: number
  requiresPhysical: number
  notAssessed: number
  /** Percentage of non-physical objectives that are met or partially met */
  coveragePercentage: number
}

// ---------------------------------------------------------------------------
// Multi-Tenant Client (MSP mode)
// ---------------------------------------------------------------------------

export interface Client {
  id: string // Internal UUID
  name: string // Display name e.g. "Acme Corp"
  tenantId: string // Azure Tenant ID (GUID)
  clientId: string // Azure App Registration Client ID
  clientSecret: string
  addedAt: string // ISO 8601
}

export interface ComplianceSummary {
  totalControls: number
  passed: number
  failed: number
  partial: number
  /** Controls that require manual attestation (organizational/procedural/physical). */
  manualRequired: number
  /** Controls with an automated check whose evidence collection FAILED this run (gaps to fix). */
  notAssessed: number
  notApplicable: number
  /** pass + fail + partial — the controls actually given a verdict (score denominator). */
  assessedControls: number
  /** Score over assessed controls only: (passed + partial*0.5) / assessedControls. */
  compliancePercentage: number
  /**
   * How much of the framework ATLAS can assess automatically:
   * (total − notApplicable − manualRequired) / (total − notApplicable).
   * The remainder needs manual attestation. Roughly stable per framework.
   */
  automatedCoverage: number
  /**
   * Of the controls ATLAS is designed to check automatically, how many were
   * successfully collected this run: assessedControls / (assessedControls + notAssessed).
   * Drops when connectors/permissions break — the guard against a score that
   * silently improves because failing controls turned into collection gaps.
   */
  collectionHealth: number
  /** True when collectionHealth < 90 — the score is computed on incomplete data. */
  lowCoverageWarning: boolean
  riskScore: 'low' | 'medium' | 'high' | 'critical'
  topFindings: string[]
}

// ---------------------------------------------------------------------------
// Graph API Client Types
// ---------------------------------------------------------------------------

export interface GraphClientConfig {
  tenantId: string
  clientId: string
  clientSecret?: string
  certificateThumbprint?: string
  scopes: string[]
}

export interface GraphApiResponse<T = unknown> {
  value: T[]
  '@odata.context'?: string
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

// ---------------------------------------------------------------------------
// Remediation DB Interface
// Minimal structural interface used by src/agents/ so the root package
// does not need @supabase/supabase-js as a dependency.
// The web app passes its SupabaseClient which satisfies this interface.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RemediationDb = any

// ---------------------------------------------------------------------------
// MCP Tool Response Types
// ---------------------------------------------------------------------------

export interface ComplianceToolResponse {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    executionTimeMs: number
    queriesExecuted: number
    tenant: string
  }
}
