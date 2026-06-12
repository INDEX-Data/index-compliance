// =============================================================================
// INDEX DSaaS - Compliance Evaluation Engine
// Evaluates Graph API evidence against control requirements
// =============================================================================

import type {
  ComplianceControl,
  ControlAssessment,
  EvidenceResult,
  ComplianceStatus,
  ComplianceReport,
  ComplianceSummary,
  FrameworkId,
} from '../types.js'
import type { GraphClient } from './graph-client.js'

// -------------------------------------------------------------------------
// Evidence Collector
// -------------------------------------------------------------------------

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

      // Some Graph endpoints return a single flat object (no .value array),
      // e.g. /policies/authorizationPolicy, /organization.
      // Wrap those in a one-element array so downstream evaluators always
      // have recordCount > 0 and can read fields from rawDataSummary.
      let records: unknown[]
      if (Array.isArray(response.value)) {
        // Standard paged response — value is the items array
        records = response.value as unknown[]
      } else {
        // Single-object response — include it only if it has non-OData fields.
        // Use 'any' here: the actual shape is a flat API object, not a paged
        // GraphApiResponse, so we need runtime key inspection.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flat = response as any
        const meaningfulKeys = (Object.keys(flat) as string[]).filter((k) => !k.startsWith('@'))
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

// -------------------------------------------------------------------------
// Control Evaluators
// -------------------------------------------------------------------------

type EvaluatorFn = (
  control: ComplianceControl,
  evidence: EvidenceResult[]
) => { status: ComplianceStatus; findings: string[]; recommendations: string[] }

const evaluators: Record<string, EvaluatorFn> = {
  // MFA enforcement via Conditional Access
  evaluate_mfa_enforcement: (_control, evidence) => {
    const caEvidence = evidence.find((e) => e.endpoint.includes('conditionalAccess'))
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }

    // Check CA policy grant controls for MFA requirement
    const policies = caEvidence.rawData as any[]
    const hasMfaPolicy = policies.some((p) => {
      const controls: string[] = p.grantControls?.builtInControls ?? []
      return controls.some(
        (c) => c.toLowerCase().includes('mfa') || c.toLowerCase().includes('multifactor')
      )
    })

    if (hasMfaPolicy && caEvidence.recordCount > 0) {
      return {
        status: 'pass',
        findings: [
          `Found ${caEvidence.recordCount} Conditional Access policies, MFA grant controls detected`,
        ],
        recommendations: [],
      }
    }

    return {
      status: 'fail',
      findings: ['No Conditional Access policies enforcing MFA were detected'],
      recommendations: [
        'Create a Conditional Access policy requiring MFA for all users',
        'At minimum, enforce MFA for admin roles and sensitive applications',
      ],
    }
  },

  // Sensitivity labels / CUI flow — assessed via audit activity + secure score AIP components
  evaluate_sensitivity_labels: (_control, evidence) => {
    const auditEvidence = evidence.find((e) => e.endpoint.includes('auditLogs'))
    const scoreEvidence = evidence.find((e) => e.endpoint.includes('secureScores'))

    if (!auditEvidence?.success && !scoreEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: [
          'Unable to collect information protection evidence (audit logs and secure score unavailable)',
        ],
        recommendations: [
          'Grant AuditLog.Read.All and SecurityEvents.Read.All to the app registration',
        ],
      }
    }

    // Check secure score enabledServices for AIP/DLP license signals
    const scoreHasAip =
      scoreEvidence?.success &&
      (scoreEvidence.rawData as any[]).some((s) =>
        ((s.enabledServices as string[]) ?? []).some(
          (svc: string) => svc === 'HasAIPP' || svc === 'HasDLP'
        )
      )

    // Check audit log for any label-related activity
    const labelActivityFound = auditEvidence?.success && auditEvidence.recordCount > 0

    if (scoreHasAip && labelActivityFound) {
      return {
        status: 'pass',
        findings: [
          'AIP/DLP licenses active (confirmed via Secure Score enabled services)',
          `${auditEvidence!.recordCount} information protection policy audit events found`,
        ],
        recommendations: [
          'Verify sensitivity labels are published to all users via label policies',
          'Enable mandatory labeling for Office apps and SharePoint',
        ],
      }
    }

    if (scoreHasAip) {
      return {
        status: 'partial',
        findings: [
          'AIP/DLP licenses active but no label policy audit activity detected',
          'Labels may not be deployed or actively enforced',
        ],
        recommendations: [
          'Publish sensitivity labels to all users via Microsoft Purview label policies',
          'Enable mandatory labeling to require users to classify documents',
          'Consider auto-labeling for known sensitive data patterns (SSN, CUI keywords)',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No AIP/DLP license signals or label policy activity detected'],
      recommendations: [
        'Deploy Microsoft Purview sensitivity labels with a minimum 3-tier taxonomy',
        'Start with: Public, Internal, Confidential/CUI',
        'Enable auto-labeling for known regulated data patterns',
      ],
    }
  },

  // Device compliance policies
  evaluate_device_compliance: (_control, evidence) => {
    const deviceEvidence = evidence.find((e) => e.endpoint.includes('deviceCompliance'))
    if (!deviceEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance policies'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }

    if (deviceEvidence.recordCount > 0) {
      return {
        status: 'pass',
        findings: [`${deviceEvidence.recordCount} device compliance policies configured`],
        recommendations: [],
      }
    }

    return {
      status: 'fail',
      findings: ['No device compliance policies found'],
      recommendations: [
        'Configure Intune device compliance policies',
        'Require encryption, OS version minimums, and antivirus',
        'Block non-compliant devices from accessing corporate resources via CA',
      ],
    }
  },

  // Role-based access control (least privilege)
  evaluate_rbac: (_control, evidence) => {
    const roleEvidence = evidence.find((e) => e.endpoint.includes('roleAssignments'))
    if (!roleEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query role assignments'],
        recommendations: ['Verify Graph API permissions: RoleManagement.Read.Directory'],
      }
    }

    // Flag if too many global admin assignments
    const assignments = roleEvidence.rawData as any[]
    const hasExcessiveAdmins =
      roleEvidence.recordCount > 5 &&
      assignments.some((a) => {
        const name: string = a.roleDefinition?.displayName ?? a.displayName ?? ''
        return (
          name.toLowerCase().includes('global administrator') ||
          name.toLowerCase().includes('globaladmin')
        )
      })

    if (hasExcessiveAdmins) {
      return {
        status: 'fail',
        findings: [
          `${roleEvidence.recordCount} privileged role assignments detected`,
          'Potential excessive Global Admin assignments',
        ],
        recommendations: [
          'Limit Global Admin to 2-4 break-glass accounts',
          'Use least-privilege roles (e.g., Exchange Admin, Security Admin)',
          'Enable Privileged Identity Management (PIM) for just-in-time access',
        ],
      }
    }

    return {
      status: 'pass',
      findings: [`${roleEvidence.recordCount} role assignments reviewed`],
      recommendations: ['Periodically review role assignments with access reviews'],
    }
  },

  // Audit logging enabled
  evaluate_audit_logging: (_control, evidence) => {
    const auditEvidence = evidence.find((e) => e.endpoint.includes('auditLogs'))
    if (!auditEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query audit logs'],
        recommendations: ['Verify Graph API permissions: AuditLog.Read.All'],
      }
    }

    if (auditEvidence.recordCount > 0) {
      return {
        status: 'pass',
        findings: ['Audit logging is active, records are being generated'],
        recommendations: [
          'Verify audit log retention meets your framework requirements',
          'Consider exporting to SIEM for long-term retention',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No audit log entries found -- logging may be disabled'],
      recommendations: [
        'Enable unified audit logging in Microsoft Purview',
        'Verify audit log search is turned on in the compliance portal',
      ],
    }
  },

  // DLP / CUI public systems — assessed via audit activity + secure score DLP components
  evaluate_dlp_policies: (_control, evidence) => {
    const auditEvidence = evidence.find((e) => e.endpoint.includes('auditLogs'))
    const scoreEvidence = evidence.find((e) => e.endpoint.includes('secureScores'))

    if (!auditEvidence?.success && !scoreEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to collect DLP/information protection evidence'],
        recommendations: [
          'Grant AuditLog.Read.All and SecurityEvents.Read.All to the app registration',
        ],
      }
    }

    const scoreHasDlp =
      scoreEvidence?.success &&
      (scoreEvidence.rawData as any[]).some((s) =>
        ((s.enabledServices as string[]) ?? []).some(
          (svc: string) => svc === 'HasDLP' || svc === 'HasAIPP'
        )
      )
    const policyActivityFound = auditEvidence?.success && auditEvidence.recordCount > 0

    if (scoreHasDlp && policyActivityFound) {
      return {
        status: 'pass',
        findings: [
          'DLP/AIP licenses active (confirmed via Secure Score)',
          `${auditEvidence!.recordCount} information protection policy events in audit log`,
        ],
        recommendations: [
          'Verify DLP policies cover all CUI-bearing workloads (Exchange, SharePoint, Teams, OneDrive)',
          'Review DLP policy match reports in the Purview compliance portal',
        ],
      }
    }

    if (scoreHasDlp) {
      return {
        status: 'partial',
        findings: [
          'DLP/AIP licenses active but no policy enforcement audit activity detected',
          'DLP policies may not be deployed or in monitoring-only mode',
        ],
        recommendations: [
          'Create DLP policies for CUI-related sensitive information types',
          'Transition monitoring-mode policies to enforcement mode',
          'Ensure policies cover SharePoint, OneDrive, Teams, and Exchange',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No DLP license signals or policy activity detected'],
      recommendations: [
        'Deploy Microsoft Purview DLP policies',
        'Define sensitive information types for CUI (e.g., DoD contract numbers, ITAR data patterns)',
        'Start in audit/monitor mode before switching to block mode',
      ],
    }
  },

  // Asset inventory — devices, apps, services
  evaluate_asset_inventory: (_control, evidence) => {
    const successful = evidence.filter((e) => e.success)
    if (successful.length === 0) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query asset inventory endpoints'],
        recommendations: [
          'Grant Application.Read.All for app/service inventory',
          'Grant DeviceManagementConfiguration.Read.All for device inventory',
        ],
      }
    }
    const totalAssets = successful.reduce((sum, e) => sum + e.recordCount, 0)
    if (totalAssets > 0) {
      return {
        status: 'pass',
        findings: [
          `Asset inventory contains records across ${successful.length} category(ies)`,
          ...successful.map((e) => `${e.queryDescription}: ${e.recordCount} record(s)`),
        ],
        recommendations: [
          'Ensure asset inventory is reviewed and updated regularly',
          'Tag assets with owner, classification, and data type metadata',
        ],
      }
    }
    return {
      status: 'fail',
      findings: ['Asset inventory endpoints reachable but no assets found'],
      recommendations: [
        'Enroll devices in Microsoft Intune (MDM) for hardware inventory',
        'Register cloud applications in Azure AD for software/service inventory',
      ],
    }
  },

  // MFA coverage — what percentage of users have MFA registered
  evaluate_mfa_coverage: (_control, evidence) => {
    const mfaEvidence = evidence.find((e) => e.endpoint.includes('authenticationMethods'))
    if (!mfaEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query user authentication method registrations'],
        recommendations: ['Verify Graph API permissions: UserAuthenticationMethod.Read.All'],
      }
    }
    if (mfaEvidence.recordCount === 0) {
      return {
        status: 'fail',
        findings: ['No user authentication method records returned'],
        recommendations: [
          'Ensure UserAuthenticationMethod.Read.All is granted and users exist in the tenant',
        ],
      }
    }
    const users = mfaEvidence.rawData as any[]
    const mfaRegistered = users.filter((u) => u.isMfaRegistered === true).length
    const mfaNotRegistered = users.filter((u) => u.isMfaRegistered === false).length
    const sampleSize = mfaEvidence.recordCount

    if (mfaRegistered > 0 && mfaNotRegistered === 0) {
      return {
        status: 'pass',
        findings: [
          `All ${sampleSize} sampled users have MFA registered`,
          'Identity credentials are being managed with strong authentication',
        ],
        recommendations: [
          'Enable Self-Service Password Reset (SSPR) to reduce helpdesk load',
          'Promote passwordless methods (FIDO2, Windows Hello, Authenticator passkey)',
        ],
      }
    }
    if (mfaRegistered > 0) {
      return {
        status: 'partial',
        findings: [
          `${mfaRegistered} of ${sampleSize} sampled users have MFA registered`,
          `${mfaNotRegistered} users in sample lack MFA registration`,
        ],
        recommendations: [
          'Enable MFA registration campaign in Azure AD to nudge unregistered users',
          'Create a Conditional Access policy blocking access until MFA is registered',
          'Use Conditional Access Authentication Strength to enforce phishing-resistant MFA',
        ],
      }
    }
    return {
      status: 'fail',
      findings: [`${sampleSize} users sampled — no MFA registrations found`],
      recommendations: [
        'Enable per-user MFA or create Conditional Access policies requiring MFA',
        'Deploy Microsoft Authenticator app to all users',
        'Set MFA registration campaign deadline in Azure AD',
      ],
    }
  },

  // Risk assessment — Secure Score posture + identity risk detections
  evaluate_risk_assessment: (_control, evidence) => {
    const scoreEvidence = evidence.find((e) => e.endpoint.includes('secureScore'))
    const riskEvidence = evidence.find((e) => e.endpoint.includes('riskDetection'))
    const riskyUsersEvidence = evidence.find((e) => e.endpoint.includes('riskyUsers'))
    const profilesEvidence = evidence.find((e) => e.endpoint.includes('scoreControlProfiles'))

    if (!scoreEvidence?.success && !riskEvidence?.success && !profilesEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query risk assessment endpoints'],
        recommendations: [
          'Grant SecurityEvents.Read.All for Secure Score access',
          'Grant IdentityRiskEvent.Read.All for identity risk detection access',
        ],
      }
    }

    const findings: string[] = []
    const recommendations: string[] = []

    if (scoreEvidence?.success && scoreEvidence.recordCount > 0) {
      const score = (scoreEvidence.rawData as any[])[0]
      if (score?.currentScore != null && score?.maxScore != null) {
        const pct = Math.round((score.currentScore / score.maxScore) * 100)
        findings.push(`Microsoft Secure Score: ${score.currentScore}/${score.maxScore} (${pct}%)`)
      } else {
        findings.push('Microsoft Secure Score data collected — posture is being tracked')
      }
    }

    if (profilesEvidence?.success && profilesEvidence.recordCount > 0) {
      findings.push(`${profilesEvidence.recordCount} Secure Score improvement actions identified`)
      recommendations.push('Review and prioritize Secure Score improvement actions')
    }

    const riskCount =
      (riskEvidence?.success ? riskEvidence.recordCount : 0) +
      (riskyUsersEvidence?.success ? riskyUsersEvidence.recordCount : 0)

    if (riskEvidence?.success || riskyUsersEvidence?.success) {
      if (riskCount > 0) {
        findings.push(`${riskCount} active risk detection(s)/risky user(s) require remediation`)
        recommendations.push(
          'Investigate and remediate active identity risk detections in Entra ID Protection'
        )
        recommendations.push(
          'Enable risk-based Conditional Access policies to auto-remediate risky sign-ins'
        )
        return { status: 'partial', findings, recommendations }
      }
      findings.push('Identity Protection active — no current risk detections')
    }

    if (findings.length > 0) {
      recommendations.push('Schedule quarterly Secure Score reviews with stakeholders')
      recommendations.push('Set Secure Score targets and track improvement trends over time')
      return { status: 'pass', findings, recommendations }
    }

    return {
      status: 'fail',
      findings: ['No risk assessment or vulnerability tracking evidence collected'],
      recommendations: [
        'Enable Microsoft Secure Score monitoring',
        'Enable Microsoft Entra ID Protection for threat detection',
        'Establish a formal vulnerability management program',
      ],
    }
  },

  // Security monitoring — alerts, incidents, risky user activity
  evaluate_security_monitoring: (_control, evidence) => {
    const alertEvidence = evidence.find((e) => e.endpoint.includes('alerts'))
    const riskEvidence = evidence.find((e) => e.endpoint.includes('riskDetection'))
    const riskyUsersEvidence = evidence.find((e) => e.endpoint.includes('riskyUsers'))
    const signInEvidence = evidence.find((e) => e.endpoint.includes('signIns'))

    const anySuccess = [alertEvidence, riskEvidence, riskyUsersEvidence, signInEvidence].some(
      (e) => e?.success
    )

    if (!anySuccess) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query security monitoring endpoints'],
        recommendations: [
          'Grant SecurityEvents.Read.All for security alerts',
          'Grant IdentityRiskEvent.Read.All for risk detections',
          'Grant AuditLog.Read.All for sign-in monitoring',
        ],
      }
    }

    const findings: string[] = []
    const recommendations: string[] = []
    let hasOpenAlerts = false

    if (alertEvidence?.success) {
      if (alertEvidence.recordCount > 0) {
        findings.push(
          `${alertEvidence.recordCount} security alert(s) found — review and triage required`
        )
        recommendations.push(
          'Triage and resolve open security alerts in Microsoft Defender / Sentinel'
        )
        hasOpenAlerts = true
      } else {
        findings.push('Security alert monitoring is active — no open alerts')
      }
    }

    if (signInEvidence?.success && signInEvidence.recordCount > 0) {
      findings.push(
        `Sign-in activity is being logged (${signInEvidence.recordCount} recent records)`
      )
    }

    const riskCount =
      (riskEvidence?.success ? riskEvidence.recordCount : 0) +
      (riskyUsersEvidence?.success ? riskyUsersEvidence.recordCount : 0)
    if (riskEvidence?.success || riskyUsersEvidence?.success) {
      if (riskCount > 0) {
        findings.push(`${riskCount} identity risk detection(s) or risky user(s) pending response`)
        recommendations.push(
          'Remediate risky users via Entra ID Protection (require MFA re-registration or reset password)'
        )
        hasOpenAlerts = true
      } else {
        findings.push('Identity Protection monitoring active — no risky users detected')
      }
    }

    recommendations.push(
      'Configure alert notification emails/webhooks to your SOC or security team'
    )
    recommendations.push('Define response SLAs: Critical ≤ 1hr, High ≤ 4hrs, Medium ≤ 24hrs')

    if (hasOpenAlerts) {
      return { status: 'partial', findings, recommendations }
    }
    return { status: 'pass', findings, recommendations }
  },

  // Configuration management — compliance policies + config profiles
  evaluate_configuration_management: (_control, evidence) => {
    const complianceEvidence = evidence.find((e) => e.endpoint.includes('deviceCompliancePolicies'))
    const configEvidence = evidence.find((e) => e.endpoint.includes('deviceConfigurations'))

    if (!complianceEvidence?.success && !configEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance or configuration profiles'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }

    const complianceCount = complianceEvidence?.success ? complianceEvidence.recordCount : 0
    const configCount = configEvidence?.success ? configEvidence.recordCount : 0
    const total = complianceCount + configCount

    if (total > 0) {
      return {
        status: 'pass',
        findings: [
          `${complianceCount} device compliance policy(ies) active`,
          `${configCount} device configuration profile(s) deployed`,
          'Configuration baselines are established in Intune',
        ],
        recommendations: [
          'Align configuration baselines with CIS Benchmarks or DISA STIGs',
          'Review and update profiles after major OS releases',
          'Enable compliance notifications to alert users about non-compliant devices',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No device compliance policies or configuration profiles found'],
      recommendations: [
        'Create device compliance policies in Microsoft Intune',
        'Define configuration profiles with security baselines (BitLocker, firewall, password policies)',
        'Use Microsoft Intune Security Baselines for pre-built configurations',
      ],
    }
  },

  // External identity and guest account management
  evaluate_guest_access: (_control, evidence) => {
    const guestEvidence = evidence.find((e) => e.endpoint.includes('/users'))
    const policyEvidence = evidence.find((e) => e.endpoint.includes('authorizationPolicy'))

    if (!guestEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query guest user accounts'],
        recommendations: ['Verify Graph API permissions: User.Read.All'],
      }
    }

    const guestCount = guestEvidence.recordCount
    const findings: string[] = []
    const recommendations: string[] = []

    // Read allowInvitesFrom directly from authorizationPolicy object
    let invitePolicy = 'unknown'
    if (policyEvidence?.success && policyEvidence.rawData.length > 0) {
      const policy = policyEvidence.rawData[0] as any
      if (policy.allowInvitesFrom) invitePolicy = policy.allowInvitesFrom
    }

    findings.push(`${guestCount} external/guest user account(s) found in the directory`)

    if (invitePolicy !== 'unknown') {
      findings.push(`External invitation policy: "${invitePolicy}"`)
    }

    // Flag elevated guest count
    if (guestCount > 50) {
      findings.push(
        `Guest account count (${guestCount}) is elevated — stale accounts may be present`
      )
      recommendations.push('Run an access review for all guest accounts in Entra ID Governance')
      recommendations.push('Remove or disable guest accounts that no longer require access')
    }

    const isOpen = invitePolicy === 'everyone'
    const isModerate = invitePolicy === 'adminsGuestInvitersAndAllMembers'
    const isRestrictive = invitePolicy === 'adminsAndGuestInviters' || invitePolicy === 'none'

    if (isOpen) {
      findings.push('Guest invitations are open to anyone — this poses an uncontrolled access risk')
      recommendations.push(
        'Change External Collaboration Settings to restrict invitations to admins only'
      )
      recommendations.push(
        'Enable quarterly access reviews for all guest users in Entra ID Governance'
      )
      return { status: 'fail', findings, recommendations }
    }

    if (isModerate) {
      findings.push('All members can invite guests — consider restricting to admins only')
      recommendations.push(
        "Restrict guest invitations to 'Admins and guest inviters' in External Collaboration Settings"
      )
    }

    if (isRestrictive) {
      findings.push('Guest invitation policy is restrictive — only admins can invite guests')
    }

    if (guestCount > 0) {
      recommendations.push('Enable periodic access reviews for existing guest accounts')
    }
    recommendations.push('Monitor guest access with Entra ID Governance access reviews')

    // No guests + restrictive policy = pass; any other combination = at least partial
    if (guestCount === 0 && (isRestrictive || invitePolicy === 'unknown')) {
      return { status: 'pass', findings, recommendations }
    }
    if (isRestrictive && guestCount <= 50) {
      return { status: 'partial', findings, recommendations }
    }
    return { status: 'partial', findings, recommendations }
  },

  // Policy existence check — verifies that security policies are configured
  evaluate_policy_exists: (_control, evidence) => {
    const successful = evidence.filter((e) => e.success)
    const failed = evidence.filter((e) => !e.success)

    if (successful.length === 0) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query policy configuration endpoints'],
        recommendations: [
          'Verify Graph API permissions: Policy.Read.All, DeviceManagementConfiguration.Read.All',
        ],
      }
    }

    const withRecords = successful.filter((e) => e.recordCount > 0)
    const findings: string[] = []
    const recommendations: string[] = []

    for (const e of withRecords) {
      findings.push(`${e.queryDescription}: ${e.recordCount} record(s) found`)
    }

    if (failed.length > 0) {
      recommendations.push(
        `${failed.length} query(ies) could not be completed — verify the required API permissions`
      )
    }

    if (withRecords.length === 0) {
      return {
        status: 'fail',
        findings: ['No policies found across all queried endpoints'],
        recommendations: [
          'Configure Conditional Access policies to enforce security requirements',
          'Set up device compliance policies in Microsoft Intune',
          'Define named locations and authentication strength policies',
        ],
      }
    }

    recommendations.push('Review policies periodically to ensure they remain current and complete')

    // All successful queries have records → full pass; some missing → partial
    if (withRecords.length < successful.length || failed.length > 0) {
      return { status: 'partial', findings, recommendations }
    }
    return { status: 'pass', findings, recommendations }
  },

  // Manual attestation — control is organizational / procedural / physical and
  // cannot be verified from automated Microsoft Graph evidence. Returns
  // manual_required (excluded from the compliance-% denominator in buildSummary,
  // and counted separately from collection failures) so it never produces a
  // misleading automated pass or fail. The customer satisfies it via document
  // upload / attestation on the report.
  evaluate_manual_attestation: (_control, _evidence) => {
    return {
      status: 'manual_required',
      findings: [
        'This control is organizational, procedural, or physical and cannot be verified through automated Microsoft Graph collection. It requires manual attestation.',
      ],
      recommendations: [
        "Attach supporting documentation or attest to this control's implementation via the evidence upload workflow.",
      ],
    }
  },

  // Generic pass-through for controls that just need evidence to exist
  evaluate_evidence_exists: (_control, evidence) => {
    const successfulQueries = evidence.filter((e) => e.success && e.recordCount > 0)
    if (successfulQueries.length === evidence.length) {
      return {
        status: 'pass',
        findings: [`All ${evidence.length} evidence queries returned data`],
        recommendations: [],
      }
    }
    if (successfulQueries.length > 0) {
      return {
        status: 'partial',
        findings: [`${successfulQueries.length}/${evidence.length} evidence queries returned data`],
        recommendations: ['Review failed queries and ensure required configurations are in place'],
      }
    }
    return {
      status: 'fail',
      findings: ['No evidence collected for this control'],
      recommendations: ['Implement the required configurations per the control requirements'],
    }
  },
}

// -------------------------------------------------------------------------
// Assessment Runner
// -------------------------------------------------------------------------

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

export async function assessFramework(
  controls: ComplianceControl[],
  frameworkId: FrameworkId,
  frameworkName: string,
  graphClient: GraphClient
): Promise<ComplianceReport> {
  const assessments: ControlAssessment[] = []

  for (const control of controls) {
    const assessment = await assessControl(control, graphClient)
    assessments.push(assessment)
  }

  const summary = buildSummary(assessments)

  return {
    reportId: `RPT-${Date.now()}`,
    tenantId: graphClient.getTenantId(),
    tenantDisplayName: process.env.TENANT_DISPLAY_NAME ?? graphClient.getTenantId(),
    frameworkId,
    frameworkName,
    generatedAt: new Date().toISOString(),
    generatedBy: 'INDEX Compliance Assessment Engine v1.0',
    summary,
    controlAssessments: assessments,
  }
}

export function buildSummary(assessments: ControlAssessment[]): ComplianceSummary {
  const total = assessments.length
  const passed = assessments.filter((a) => a.status === 'pass').length
  const failed = assessments.filter((a) => a.status === 'fail').length
  const partial = assessments.filter((a) => a.status === 'partial').length
  const manualRequired = assessments.filter((a) => a.status === 'manual_required').length
  const notAssessed = assessments.filter((a) => a.status === 'not_assessed').length
  const notApplicable = assessments.filter((a) => a.status === 'not_applicable').length

  // Score is computed ONLY over controls that actually received a verdict.
  // manual_required, not_assessed, and not_applicable are all excluded so the
  // percentage never claims confidence about something we didn't really check.
  const assessedControls = passed + failed + partial
  const compliancePercentage =
    assessedControls > 0 ? Math.round(((passed + partial * 0.5) / assessedControls) * 100) : 0

  // How much of the framework is automatable at all (the rest needs attestation).
  const inScope = total - notApplicable
  const automatable = inScope - manualRequired
  const automatedCoverage = inScope > 0 ? Math.round((automatable / inScope) * 100) : 0

  // Of the automatable controls, how many were successfully collected this run.
  // A drop here means connectors/permissions broke — the score is now on
  // incomplete data even if the percentage looks fine (or deceptively better).
  const collectionHealth =
    automatable > 0 ? Math.round((assessedControls / automatable) * 100) : 100
  const lowCoverageWarning = collectionHealth < 90

  let riskScore: ComplianceSummary['riskScore']
  if (compliancePercentage >= 90) riskScore = 'low'
  else if (compliancePercentage >= 70) riskScore = 'medium'
  else if (compliancePercentage >= 50) riskScore = 'high'
  else riskScore = 'critical'

  // Don't advertise a confident "low risk" when we couldn't collect a chunk of
  // the automatable controls — cap optimism until collection health recovers.
  if (lowCoverageWarning && riskScore === 'low') riskScore = 'medium'

  const topFindings = assessments
    .filter((a) => a.status === 'fail')
    .flatMap((a) => a.findings)
    .slice(0, 5)

  return {
    totalControls: total,
    passed,
    failed,
    partial,
    manualRequired,
    notAssessed,
    notApplicable,
    assessedControls,
    compliancePercentage,
    automatedCoverage,
    collectionHealth,
    lowCoverageWarning,
    riskScore,
    topFindings,
  }
}
