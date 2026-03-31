// Core types for Edge Functions — mirrors src/types.ts

export type FrameworkId =
  | 'CMMC_L2' | 'NIST_800_171' | 'HIPAA' | 'FINRA' | 'FERPA' | 'NIST_CSF' | 'SOC2'

export interface GraphClientConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

export interface GraphApiResponse<T = unknown> {
  value: T[]
  '@odata.context'?: string
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

export interface EvidenceQuery {
  id: string
  description: string
  endpoint: string
  method: 'GET' | 'POST'
  category: string
  requiredPermissions: string[]
  selectFields?: string[]
  filterExpression?: string
  expandFields?: string[]
  apiVersion?: 'v1' | 'beta'
  topN?: number
}

export interface EvaluationCriteria {
  type: 'boolean' | 'threshold' | 'exists' | 'contains' | 'custom'
  field?: string
  minimumValue?: number
  requiredValues?: string[]
  passingCondition: string
  customEvaluator?: string
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

export type ComplianceStatus = 'pass' | 'fail' | 'partial' | 'not_assessed' | 'not_applicable'

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
  frameworkId: FrameworkId
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
  riskScore: 'low' | 'medium' | 'high' | 'critical'
  topFindings: string[]
}

export interface ComplianceReport {
  reportId: string
  tenantId: string
  tenantDisplayName: string
  frameworkId: FrameworkId
  frameworkName: string
  generatedAt: string
  generatedBy: string
  summary: ComplianceSummary
  controlAssessments: ControlAssessment[]
  clientId?: string
  clientName?: string
}

export interface FrameworkDefinition {
  id: FrameworkId
  name: string
  version: string
  description: string
  controls: ComplianceControl[]
}
