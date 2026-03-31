// Compliance Evaluation Engine — Deno-compatible port of src/services/compliance-engine.ts

import type {
  ComplianceControl, ControlAssessment, EvidenceResult,
  ComplianceStatus, ComplianceReport, ComplianceSummary, FrameworkId,
} from './types.ts'
import type { GraphClient } from './graph-client.ts'

// ── Evidence Collector ───────────────────────────────────────────────────────

export async function collectEvidence(
  control: ComplianceControl,
  graphClient: GraphClient
): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = []

  for (const query of control.evidenceQueries) {
    const collectedAt = new Date().toISOString()
    try {
      const response = await graphClient.query(query.endpoint, {
        apiVersion: query.apiVersion,
        select: query.selectFields,
        filter: query.filterExpression,
        expand: query.expandFields,
        top: query.topN,
      })

      let records: unknown[]
      if (Array.isArray(response.value)) {
        records = response.value as unknown[]
      } else {
        const flat = response as any
        const meaningfulKeys = (Object.keys(flat) as string[]).filter(k => !k.startsWith('@'))
        records = meaningfulKeys.length > 0 ? [response] : []
      }

      results.push({
        queryId: query.id,
        queryDescription: query.description,
        endpoint: query.endpoint,
        rawData: records,
        recordCount: records.length,
        collectedAt,
        success: true,
      })
    } catch (error) {
      results.push({
        queryId: query.id,
        queryDescription: query.description,
        endpoint: query.endpoint,
        rawData: [],
        recordCount: 0,
        collectedAt,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

// ── Control Evaluators ───────────────────────────────────────────────────────

type EvaluatorFn = (
  control: ComplianceControl,
  evidence: EvidenceResult[]
) => { status: ComplianceStatus; findings: string[]; recommendations: string[] }

const evaluators: Record<string, EvaluatorFn> = {

  evaluate_mfa_enforcement: (_control, evidence) => {
    const caEvidence = evidence.find(e => e.endpoint.includes('conditionalAccess'))
    if (!caEvidence?.success) {
      return { status: 'not_assessed', findings: ['Unable to query Conditional Access policies'], recommendations: ['Verify Graph API permissions: Policy.Read.All'] }
    }
    const policies = caEvidence.rawData as any[]
    const hasMfaPolicy = policies.some(p => {
      const controls: string[] = p.grantControls?.builtInControls ?? []
      return controls.some(c => c.toLowerCase().includes('mfa') || c.toLowerCase().includes('multifactor'))
    })
    if (hasMfaPolicy && caEvidence.recordCount > 0) {
      return { status: 'pass', findings: [`Found ${caEvidence.recordCount} Conditional Access policies, MFA grant controls detected`], recommendations: [] }
    }
    return { status: 'fail', findings: ['No Conditional Access policies enforcing MFA were detected'], recommendations: ['Create a Conditional Access policy requiring MFA for all users', 'At minimum, enforce MFA for admin roles and sensitive applications'] }
  },

  evaluate_sensitivity_labels: (_control, evidence) => {
    const auditEvidence = evidence.find(e => e.endpoint.includes('auditLogs'))
    const scoreEvidence = evidence.find(e => e.endpoint.includes('secureScores'))
    if (!auditEvidence?.success && !scoreEvidence?.success) {
      return { status: 'not_assessed', findings: ['Unable to collect information protection evidence'], recommendations: ['Grant AuditLog.Read.All and SecurityEvents.Read.All'] }
    }
    const scoreHasAip = scoreEvidence?.success && (scoreEvidence.rawData as any[]).some(s => (s.enabledServices as string[] ?? []).some((svc: string) => svc === 'HasAIPP' || svc === 'HasDLP'))
    const labelActivityFound = auditEvidence?.success && auditEvidence.recordCount > 0
    if (scoreHasAip && labelActivityFound) return { status: 'pass', findings: ['AIP/DLP licenses active', `${auditEvidence!.recordCount} information protection policy audit events found`], recommendations: ['Verify sensitivity labels are published to all users'] }
    if (scoreHasAip) return { status: 'partial', findings: ['AIP/DLP licenses active but no label policy audit activity detected'], recommendations: ['Publish sensitivity labels to all users via Microsoft Purview'] }
    return { status: 'fail', findings: ['No AIP/DLP license signals or label policy activity detected'], recommendations: ['Deploy Microsoft Purview sensitivity labels'] }
  },

  evaluate_device_compliance: (_control, evidence) => {
    const e = evidence.find(e => e.endpoint.includes('deviceCompliance'))
    if (!e?.success) return { status: 'not_assessed', findings: ['Unable to query device compliance policies'], recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'] }
    if (e.recordCount > 0) return { status: 'pass', findings: [`${e.recordCount} device compliance policies configured`], recommendations: [] }
    return { status: 'fail', findings: ['No device compliance policies found'], recommendations: ['Configure Intune device compliance policies'] }
  },

  evaluate_rbac: (_control, evidence) => {
    const e = evidence.find(e => e.endpoint.includes('roleAssignments'))
    if (!e?.success) return { status: 'not_assessed', findings: ['Unable to query role assignments'], recommendations: ['Verify Graph API permissions: RoleManagement.Read.Directory'] }
    const assignments = e.rawData as any[]
    const hasExcessiveAdmins = e.recordCount > 5 && assignments.some(a => {
      const name: string = a.roleDefinition?.displayName ?? a.displayName ?? ''
      return name.toLowerCase().includes('global administrator')
    })
    if (hasExcessiveAdmins) return { status: 'fail', findings: [`${e.recordCount} privileged role assignments detected`, 'Potential excessive Global Admin assignments'], recommendations: ['Limit Global Admin to 2-4 break-glass accounts', 'Use least-privilege roles', 'Enable PIM for just-in-time access'] }
    return { status: 'pass', findings: [`${e.recordCount} role assignments reviewed`], recommendations: ['Periodically review role assignments with access reviews'] }
  },

  evaluate_audit_logging: (_control, evidence) => {
    const e = evidence.find(e => e.endpoint.includes('auditLogs'))
    if (!e?.success) return { status: 'not_assessed', findings: ['Unable to query audit logs'], recommendations: ['Verify Graph API permissions: AuditLog.Read.All'] }
    if (e.recordCount > 0) return { status: 'pass', findings: ['Audit logging is active, records are being generated'], recommendations: ['Verify audit log retention meets your framework requirements'] }
    return { status: 'fail', findings: ['No audit log entries found -- logging may be disabled'], recommendations: ['Enable unified audit logging in Microsoft Purview'] }
  },

  evaluate_dlp_policies: (_control, evidence) => {
    const auditEvidence = evidence.find(e => e.endpoint.includes('auditLogs'))
    const scoreEvidence = evidence.find(e => e.endpoint.includes('secureScores'))
    if (!auditEvidence?.success && !scoreEvidence?.success) return { status: 'not_assessed', findings: ['Unable to collect DLP/information protection evidence'], recommendations: ['Grant AuditLog.Read.All and SecurityEvents.Read.All'] }
    const scoreHasDlp = scoreEvidence?.success && (scoreEvidence.rawData as any[]).some(s => (s.enabledServices as string[] ?? []).some((svc: string) => svc === 'HasDLP' || svc === 'HasAIPP'))
    const policyActivityFound = auditEvidence?.success && auditEvidence.recordCount > 0
    if (scoreHasDlp && policyActivityFound) return { status: 'pass', findings: ['DLP/AIP licenses active', `${auditEvidence!.recordCount} information protection policy events`], recommendations: ['Verify DLP policies cover all CUI-bearing workloads'] }
    if (scoreHasDlp) return { status: 'partial', findings: ['DLP/AIP licenses active but no policy enforcement audit activity'], recommendations: ['Create DLP policies for CUI-related sensitive information types'] }
    return { status: 'fail', findings: ['No DLP license signals or policy activity detected'], recommendations: ['Deploy Microsoft Purview DLP policies'] }
  },

  evaluate_asset_inventory: (_control, evidence) => {
    const successful = evidence.filter(e => e.success)
    if (successful.length === 0) return { status: 'not_assessed', findings: ['Unable to query asset inventory endpoints'], recommendations: ['Grant Application.Read.All and DeviceManagementConfiguration.Read.All'] }
    const totalAssets = successful.reduce((sum, e) => sum + e.recordCount, 0)
    if (totalAssets > 0) return { status: 'pass', findings: [`Asset inventory contains records across ${successful.length} category(ies)`, ...successful.map(e => `${e.queryDescription}: ${e.recordCount} record(s)`)], recommendations: ['Ensure asset inventory is reviewed regularly'] }
    return { status: 'fail', findings: ['Asset inventory endpoints reachable but no assets found'], recommendations: ['Enroll devices in Microsoft Intune'] }
  },

  evaluate_mfa_coverage: (_control, evidence) => {
    const e = evidence.find(e => e.endpoint.includes('authenticationMethods'))
    if (!e?.success) return { status: 'not_assessed', findings: ['Unable to query user authentication method registrations'], recommendations: ['Verify Graph API permissions: UserAuthenticationMethod.Read.All'] }
    if (e.recordCount === 0) return { status: 'fail', findings: ['No user authentication method records returned'], recommendations: ['Ensure UserAuthenticationMethod.Read.All is granted'] }
    const users = e.rawData as any[]
    const mfaRegistered = users.filter(u => u.isMfaRegistered === true).length
    const mfaNotRegistered = users.filter(u => u.isMfaRegistered === false).length
    if (mfaRegistered > 0 && mfaNotRegistered === 0) return { status: 'pass', findings: [`All ${e.recordCount} sampled users have MFA registered`], recommendations: ['Promote passwordless methods (FIDO2, Windows Hello)'] }
    if (mfaRegistered > 0) return { status: 'partial', findings: [`${mfaRegistered} of ${e.recordCount} sampled users have MFA registered`], recommendations: ['Enable MFA registration campaign', 'Create a CA policy blocking access until MFA is registered'] }
    return { status: 'fail', findings: [`${e.recordCount} users sampled — no MFA registrations found`], recommendations: ['Enable per-user MFA or create Conditional Access policies requiring MFA'] }
  },

  evaluate_risk_assessment: (_control, evidence) => {
    const scoreEvidence = evidence.find(e => e.endpoint.includes('secureScore'))
    const riskEvidence = evidence.find(e => e.endpoint.includes('riskDetection'))
    const riskyUsersEvidence = evidence.find(e => e.endpoint.includes('riskyUsers'))
    if (!scoreEvidence?.success && !riskEvidence?.success) return { status: 'not_assessed', findings: ['Unable to query risk assessment endpoints'], recommendations: ['Grant SecurityEvents.Read.All and IdentityRiskEvent.Read.All'] }
    const findings: string[] = []
    const recommendations: string[] = []
    if (scoreEvidence?.success && scoreEvidence.recordCount > 0) {
      const score = (scoreEvidence.rawData as any[])[0]
      if (score?.currentScore != null && score?.maxScore != null) findings.push(`Microsoft Secure Score: ${score.currentScore}/${score.maxScore} (${Math.round((score.currentScore / score.maxScore) * 100)}%)`)
      else findings.push('Microsoft Secure Score data collected')
    }
    const riskCount = (riskEvidence?.success ? riskEvidence.recordCount : 0) + (riskyUsersEvidence?.success ? riskyUsersEvidence.recordCount : 0)
    if (riskCount > 0) { findings.push(`${riskCount} active risk detection(s)/risky user(s)`); recommendations.push('Investigate and remediate active identity risk detections'); return { status: 'partial', findings, recommendations } }
    if (findings.length > 0) { recommendations.push('Schedule quarterly Secure Score reviews'); return { status: 'pass', findings, recommendations } }
    return { status: 'fail', findings: ['No risk assessment evidence collected'], recommendations: ['Enable Microsoft Secure Score monitoring', 'Enable Microsoft Entra ID Protection'] }
  },

  evaluate_security_monitoring: (_control, evidence) => {
    const alertEvidence = evidence.find(e => e.endpoint.includes('alerts'))
    const signInEvidence = evidence.find(e => e.endpoint.includes('signIns'))
    const anySuccess = [alertEvidence, signInEvidence].some(e => e?.success)
    if (!anySuccess) return { status: 'not_assessed', findings: ['Unable to query security monitoring endpoints'], recommendations: ['Grant SecurityEvents.Read.All and AuditLog.Read.All'] }
    const findings: string[] = []
    let hasOpenAlerts = false
    if (alertEvidence?.success) {
      if (alertEvidence.recordCount > 0) { findings.push(`${alertEvidence.recordCount} security alert(s) found`); hasOpenAlerts = true }
      else findings.push('Security alert monitoring is active — no open alerts')
    }
    if (signInEvidence?.success && signInEvidence.recordCount > 0) findings.push(`Sign-in activity is being logged (${signInEvidence.recordCount} recent records)`)
    if (hasOpenAlerts) return { status: 'partial', findings, recommendations: ['Triage and resolve open security alerts'] }
    return { status: 'pass', findings, recommendations: ['Configure alert notification emails/webhooks'] }
  },

  evaluate_configuration_management: (_control, evidence) => {
    const complianceEvidence = evidence.find(e => e.endpoint.includes('deviceCompliancePolicies'))
    const configEvidence = evidence.find(e => e.endpoint.includes('deviceConfigurations'))
    if (!complianceEvidence?.success && !configEvidence?.success) return { status: 'not_assessed', findings: ['Unable to query device compliance or configuration profiles'], recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'] }
    const total = (complianceEvidence?.success ? complianceEvidence.recordCount : 0) + (configEvidence?.success ? configEvidence.recordCount : 0)
    if (total > 0) return { status: 'pass', findings: ['Configuration baselines are established in Intune'], recommendations: ['Align with CIS Benchmarks or DISA STIGs'] }
    return { status: 'fail', findings: ['No device compliance policies or configuration profiles found'], recommendations: ['Create device compliance policies in Microsoft Intune'] }
  },

  evaluate_guest_access: (_control, evidence) => {
    const guestEvidence = evidence.find(e => e.endpoint.includes('/users'))
    const policyEvidence = evidence.find(e => e.endpoint.includes('authorizationPolicy'))
    if (!guestEvidence?.success) return { status: 'not_assessed', findings: ['Unable to query guest user accounts'], recommendations: ['Verify Graph API permissions: User.Read.All'] }
    const guestCount = guestEvidence.recordCount
    const findings: string[] = [`${guestCount} external/guest user account(s) found`]
    let invitePolicy = 'unknown'
    if (policyEvidence?.success && policyEvidence.rawData.length > 0) {
      const policy = policyEvidence.rawData[0] as any
      if (policy.allowInvitesFrom) invitePolicy = policy.allowInvitesFrom
      findings.push(`External invitation policy: "${invitePolicy}"`)
    }
    if (invitePolicy === 'everyone') return { status: 'fail', findings: [...findings, 'Guest invitations are open to anyone'], recommendations: ['Restrict invitations to admins only'] }
    if (guestCount === 0) return { status: 'pass', findings, recommendations: ['Monitor guest access with access reviews'] }
    return { status: 'partial', findings, recommendations: ['Enable periodic access reviews for guest accounts'] }
  },

  evaluate_policy_exists: (_control, evidence) => {
    const successful = evidence.filter(e => e.success)
    if (successful.length === 0) return { status: 'not_assessed', findings: ['Unable to query policy configuration endpoints'], recommendations: ['Verify Graph API permissions'] }
    const withRecords = successful.filter(e => e.recordCount > 0)
    if (withRecords.length === 0) return { status: 'fail', findings: ['No policies found across all queried endpoints'], recommendations: ['Configure Conditional Access and device compliance policies'] }
    const findings = withRecords.map(e => `${e.queryDescription}: ${e.recordCount} record(s) found`)
    if (withRecords.length < successful.length) return { status: 'partial', findings, recommendations: ['Review policies periodically'] }
    return { status: 'pass', findings, recommendations: ['Review policies periodically'] }
  },

  evaluate_evidence_exists: (_control, evidence) => {
    const successfulQueries = evidence.filter(e => e.success && e.recordCount > 0)
    if (successfulQueries.length === evidence.length) return { status: 'pass', findings: [`All ${evidence.length} evidence queries returned data`], recommendations: [] }
    if (successfulQueries.length > 0) return { status: 'partial', findings: [`${successfulQueries.length}/${evidence.length} evidence queries returned data`], recommendations: ['Review failed queries and ensure required configurations are in place'] }
    return { status: 'fail', findings: ['No evidence collected for this control'], recommendations: ['Implement the required configurations per the control requirements'] }
  },
}

// ── Assessment Runner ────────────────────────────────────────────────────────

export function getEvaluator(name: string): EvaluatorFn {
  return evaluators[name] ?? evaluators.evaluate_evidence_exists
}

export async function assessControl(
  control: ComplianceControl,
  graphClient: GraphClient
): Promise<ControlAssessment> {
  const evidence = await collectEvidence(control, graphClient)
  const evaluatorName = control.evaluationCriteria.customEvaluator ?? 'evaluate_evidence_exists'
  const evaluator = getEvaluator(evaluatorName)
  const result = evaluator(control, evidence)

  return {
    controlId: control.controlId,
    controlTitle: control.title,
    frameworkId: control.frameworkId,
    family: control.family,
    status: result.status,
    evidenceCollected: evidence,
    findings: result.findings,
    recommendations: result.recommendations,
    assessedAt: new Date().toISOString(),
  }
}

export function buildSummary(assessments: ControlAssessment[]): ComplianceSummary {
  const total = assessments.length
  const passed = assessments.filter(a => a.status === 'pass').length
  const failed = assessments.filter(a => a.status === 'fail').length
  const partial = assessments.filter(a => a.status === 'partial').length
  const notAssessed = assessments.filter(a => a.status === 'not_assessed').length
  const notApplicable = assessments.filter(a => a.status === 'not_applicable').length

  const assessable = total - notApplicable - notAssessed
  const compliancePercentage = assessable > 0
    ? Math.round(((passed + partial * 0.5) / assessable) * 100)
    : 0

  let riskScore: ComplianceSummary['riskScore']
  if (compliancePercentage >= 90) riskScore = 'low'
  else if (compliancePercentage >= 70) riskScore = 'medium'
  else if (compliancePercentage >= 50) riskScore = 'high'
  else riskScore = 'critical'

  const topFindings = assessments
    .filter(a => a.status === 'fail')
    .flatMap(a => a.findings)
    .slice(0, 5)

  return {
    totalControls: total, passed, failed, partial, notAssessed, notApplicable,
    compliancePercentage, riskScore, topFindings,
  }
}
