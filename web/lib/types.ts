// Types mirroring the backend compliance engine output shapes

export type ComplianceStatus = 'pass' | 'fail' | 'partial' | 'not_assessed' | 'not_applicable'
export type RiskScore = 'low' | 'medium' | 'high' | 'critical'

export interface EvidenceResult {
  queryId: string
  queryDescription: string
  endpoint: string
  rawData: unknown[]
  recordCount: number
  collectedAt: string
  success: boolean
  errorMessage?: string
}

export interface ControlAssessment {
  controlId: string
  controlTitle: string
  frameworkId: string
  family: string
  status: ComplianceStatus
  evidenceCollected: EvidenceResult[]
  findings: string[]
  recommendations: string[]
  assessedAt: string
}

export interface ComplianceSummary {
  totalControls: number
  passed: number
  failed: number
  partial: number
  notAssessed: number
  notApplicable: number
  compliancePercentage: number
  riskScore: RiskScore
  topFindings: string[]
}

export interface ComplianceReport {
  reportId: string
  tenantId: string
  tenantDisplayName: string
  frameworkId: string
  frameworkName: string
  generatedAt: string
  generatedBy: string
  summary: ComplianceSummary
  controlAssessments: ControlAssessment[]
  clientId?: string
  clientName?: string
}

export interface FrameworkMeta {
  id: string
  name: string
  version: string
  description: string
  controlCount: number
  implemented: boolean
  category?: string
  categoryLabel?: string
}

export interface ReportMeta {
  reportId: string
  frameworkId: string
  frameworkName: string
  tenantDisplayName: string
  generatedAt: string
  summary: ComplianceSummary
  clientId?: string
  clientName?: string
}

export interface Client {
  id: string
  name: string
  tenantId: string
  clientId: string       // Azure app registration client ID
  clientSecret: string   // Masked on API responses (e.g. "abcd••••••••")
  addedAt: string
  notes?: string
}

export interface ConfigStatus {
  configured: boolean
  tenantId?: string
  tenantName?: string
}

// SSE event shapes
export type SSEEvent =
  | { type: 'start';                  frameworkId: string; frameworkName: string; total: number }
  | { type: 'progress';               controlId: string;   title: string;         index: number; total: number }
  | { type: 'result';                 assessment: ControlAssessment }
  | { type: 'objectives_initialized'; reportId: string;    summary: DIBCACObjectiveSummary }
  | { type: 'complete';               report: ComplianceReport }
  | { type: 'error';                  message: string }

// ---------------------------------------------------------------------------
// DIBCAC 320 Objective Tracking
// ---------------------------------------------------------------------------

export type ObjectiveStandard =
  | 'Document'
  | 'Screen Share'
  | 'Artifact'
  | 'Physical Review'
  | 'Artifact and Screen Share'

export type ObjectiveAutomation = 'automated' | 'semi-automated' | 'manual' | 'physical'

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

export interface DIBCACObjectiveDef {
  objectiveId: string
  requirementNumber: string
  controlId: string
  domain: string
  domainName: string
  text: string
  standard: ObjectiveStandard
  automation: ObjectiveAutomation
}

export interface ObjectiveStatus {
  objectiveId: string
  status: ObjectiveStatusValue
  evidenceSource: ObjectiveEvidenceSource
  attestationText?: string
  documentRef?: string
  documentName?: string
  assessedAt?: string
  assessedBy?: string
}

export interface EnrichedObjective extends DIBCACObjectiveDef {
  status: ObjectiveStatus
}

export interface DIBCACObjectiveSummary {
  total: number
  met: number
  partiallyMet: number
  notMet: number
  requiresManual: number
  requiresPhysical: number
  notAssessed: number
  coveragePercentage: number
}

export interface ObjectivesResponse {
  reportId: string
  summary: DIBCACObjectiveSummary
  objectives: EnrichedObjective[]
}

// ---------------------------------------------------------------------------
// Client Invitations
// ---------------------------------------------------------------------------

export interface Invitation {
  id: string
  clientName: string
  email?: string
  token: string
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
  expiresAt: string
  clientId?: string
}

// ---------------------------------------------------------------------------
// Client Integrations (per-platform credentials stored in DB)
// ---------------------------------------------------------------------------

export interface ClientIntegration {
  id: string
  platform: string
  status: 'connected' | 'error' | 'pending'
  connectedAt?: string
  lastTestedAt?: string
  errorMessage?: string
  config?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Team Invites & Memberships
// ---------------------------------------------------------------------------

export interface TeamInvite {
  id: string
  email: string
  token: string
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
  expiresAt: string
}

export interface TeamMember {
  id: string
  memberId: string
  joinedAt: string
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string
  userId: string
  accountType: 'org' | 'msp'
  companyName: string
  role?: string
  orgSize?: string
  industry?: string
  onboardedAt: string
}
