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
import { GraphAuthError } from './graph-client.js'
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
      // A credential-class failure isn't a per-query gap — it breaks every query.
      // Re-throw so the caller (runAssessment) aborts the whole run with one
      // actionable message instead of recording it as N collected failures.
      if (error instanceof GraphAuthError) throw error
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

// ─── Deep-inspection helpers ─────────────────────────────────────────────────
// These read the ACTUAL policy payloads returned by Graph so a "pass" always
// reflects the specific setting a control requires — never just "data exists".

/** Find the CA *policies* evidence (not namedLocations, which shares the prefix). */
function findCaPolicies(evidence: EvidenceResult[]): EvidenceResult | undefined {
  return evidence.find((e) => e.endpoint.includes('conditionalAccess/policies'))
}

/** Only CA policies in the 'enabled' state count as enforcement. */
function enabledCaPolicies(e: EvidenceResult | undefined): any[] {
  if (!e?.success) return []
  return (e.rawData as any[]).filter((p) => p?.state === 'enabled')
}

/** Report-only CA policies — configured but NOT enforcing. */
function reportOnlyCaPolicies(e: EvidenceResult | undefined): any[] {
  if (!e?.success) return []
  return (e.rawData as any[]).filter((p) => p?.state === 'enabledForReportingButNotEnforced')
}

function policyHasMfaGrant(p: any): boolean {
  const controls: string[] = p?.grantControls?.builtInControls ?? []
  return controls.some(
    (c) => c.toLowerCase().includes('mfa') || c.toLowerCase().includes('multifactor')
  )
}

function policyTargetsAllUsers(p: any): boolean {
  const include: string[] = p?.conditions?.users?.includeUsers ?? []
  return include.some((u) => u === 'All')
}

/**
 * Scan a device policy object for a settings key matching `keyPattern`
 * whose value satisfies `valueTest`. Generic key scan keeps this working
 * across platform-specific compliance policy types
 * (windows10CompliancePolicy, iosCompliancePolicy, androidCompliancePolicy, …).
 */
function devicePolicySetting(
  p: any,
  keyPattern: RegExp,
  valueTest: (v: unknown) => boolean
): boolean {
  return Object.entries(p ?? {}).some(([k, v]) => keyPattern.test(k) && valueTest(v))
}

function policyName(p: any): string {
  return p?.displayName ?? p?.name ?? '(unnamed policy)'
}

const evaluators: Record<string, EvaluatorFn> = {
  // MFA enforcement via Conditional Access — counts ONLY enabled policies.
  evaluate_mfa_enforcement: (_control, evidence) => {
    const caEvidence =
      findCaPolicies(evidence) ?? evidence.find((e) => e.endpoint.includes('conditionalAccess'))
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }

    const enabled = enabledCaPolicies(caEvidence)
    const reportOnly = reportOnlyCaPolicies(caEvidence)
    const enabledMfa = enabled.filter(policyHasMfaGrant)
    const reportOnlyMfa = reportOnly.filter(policyHasMfaGrant)

    if (enabledMfa.length > 0) {
      const allUsers = enabledMfa.some(policyTargetsAllUsers)
      const findings = [
        `${enabledMfa.length} ENABLED Conditional Access policy(ies) require MFA: ${enabledMfa.map(policyName).join(', ')}`,
        allUsers
          ? 'At least one MFA policy targets All Users'
          : 'MFA policies are scoped to specific users/groups — not all users are covered',
      ]
      return {
        status: allUsers ? 'pass' : 'partial',
        findings,
        recommendations: allUsers
          ? []
          : ['Extend an MFA Conditional Access policy to All Users (with break-glass exclusions)'],
      }
    }

    if (reportOnlyMfa.length > 0) {
      return {
        status: 'partial',
        findings: [
          `${reportOnlyMfa.length} MFA policy(ies) exist but are in REPORT-ONLY mode — not enforcing`,
        ],
        recommendations: ['Switch report-only MFA policies to On after reviewing sign-in impact'],
      }
    }

    return {
      status: 'fail',
      findings: ['No enabled Conditional Access policies enforcing MFA were detected'],
      recommendations: [
        'Create a Conditional Access policy requiring MFA for all users',
        'At minimum, enforce MFA for admin roles and sensitive applications',
      ],
    }
  },

  // CA session controls — sign-in frequency / persistent browser session.
  // Used by session-termination & re-authentication controls.
  evaluate_ca_session_controls: (_control, evidence) => {
    const caEvidence = findCaPolicies(evidence)
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }
    const enabled = enabledCaPolicies(caEvidence)
    const signInFreq = enabled.filter(
      (p) => p?.sessionControls?.signInFrequency?.isEnabled === true
    )
    const persistentBrowser = enabled.filter(
      (p) => p?.sessionControls?.persistentBrowser?.isEnabled === true
    )

    if (signInFreq.length > 0) {
      const details = signInFreq.map((p) => {
        const sf = p.sessionControls.signInFrequency
        const interval =
          sf.frequencyInterval === 'everyTime'
            ? 'every sign-in'
            : `${sf.value ?? '?'} ${sf.type ?? ''}`
        return `${policyName(p)} (re-auth: ${interval})`
      })
      return {
        status: 'pass',
        findings: [
          `Sign-in frequency (session re-authentication) is enforced by ${signInFreq.length} enabled policy(ies): ${details.join('; ')}`,
          persistentBrowser.length > 0
            ? 'Persistent browser session restrictions are also configured'
            : 'No persistent browser session restriction detected',
        ],
        recommendations:
          persistentBrowser.length > 0
            ? []
            : [
                'Add a persistent browser session control (set to Never persistent) for sensitive apps',
              ],
      }
    }

    if (persistentBrowser.length > 0) {
      return {
        status: 'partial',
        findings: [
          'Persistent browser session restrictions exist, but no sign-in frequency (re-authentication) control is enforced',
        ],
        recommendations: ['Add a sign-in frequency session control to an enabled CA policy'],
      }
    }

    return {
      status: 'fail',
      findings: [
        `${enabled.length} enabled CA policy(ies) inspected — none configure session controls (sign-in frequency or persistent browser)`,
      ],
      recommendations: [
        'Create a CA policy with a sign-in frequency control to force periodic re-authentication',
        'Disable persistent browser sessions for unmanaged devices',
      ],
    }
  },

  // CA Terms of Use — grantControls.termsOfUse must be present on an enabled policy.
  evaluate_ca_terms_of_use: (_control, evidence) => {
    const caEvidence = findCaPolicies(evidence)
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }
    const enabled = enabledCaPolicies(caEvidence)
    const touPolicies = enabled.filter((p) => (p?.grantControls?.termsOfUse ?? []).length > 0)

    if (touPolicies.length > 0) {
      return {
        status: 'pass',
        findings: [
          `Terms of Use acceptance is enforced at sign-in by ${touPolicies.length} enabled CA policy(ies): ${touPolicies.map(policyName).join(', ')}`,
        ],
        recommendations: ['Review ToU content annually to keep privacy/security notices current'],
      }
    }

    return {
      status: 'fail',
      findings: [
        `${enabled.length} enabled CA policy(ies) inspected — none require Terms of Use acceptance`,
      ],
      recommendations: [
        'Create a Terms of Use in Entra ID (Identity Governance) containing the required privacy and security notices',
        'Attach it to a Conditional Access policy as a grant control for all users',
      ],
    }
  },

  // CA compliant/managed-device requirement — verifies devices must be
  // compliant or hybrid-joined to connect (remote access confidentiality).
  evaluate_ca_compliant_device: (_control, evidence) => {
    const caEvidence = findCaPolicies(evidence)
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }
    const enabled = enabledCaPolicies(caEvidence)
    const deviceTrust = enabled.filter((p) => {
      const controls: string[] = p?.grantControls?.builtInControls ?? []
      return controls.includes('compliantDevice') || controls.includes('domainJoinedDevice')
    })

    if (deviceTrust.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${deviceTrust.length} enabled CA policy(ies) require a compliant or hybrid-joined device: ${deviceTrust.map(policyName).join(', ')}`,
          'All Microsoft 365 service connections are TLS-encrypted by platform default',
        ],
        recommendations: [],
      }
    }

    return {
      status: 'fail',
      findings: [
        `${enabled.length} enabled CA policy(ies) inspected — none require device compliance or hybrid join for access`,
      ],
      recommendations: [
        'Create a CA policy granting access only from compliant (Intune) or hybrid-joined devices',
        'Scope it to apps that hold regulated data first, then expand',
      ],
    }
  },

  // Named locations + CA policies that actually reference locations.
  evaluate_ca_named_locations: (_control, evidence) => {
    const locEvidence = evidence.find((e) => e.endpoint.includes('namedLocations'))
    const caEvidence = findCaPolicies(evidence)

    if (!locEvidence?.success && !caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query named locations or Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }

    const locationCount = locEvidence?.success ? locEvidence.recordCount : 0
    const enabled = enabledCaPolicies(caEvidence)
    const locationPolicies = enabled.filter((p) => {
      const loc = p?.conditions?.locations
      return (loc?.includeLocations ?? []).length > 0 || (loc?.excludeLocations ?? []).length > 0
    })

    if (locationCount > 0 && locationPolicies.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${locationCount} named location(s) defined`,
          `${locationPolicies.length} enabled CA policy(ies) use location conditions to channel access: ${locationPolicies.map(policyName).join(', ')}`,
        ],
        recommendations: ['Review named location IP ranges quarterly'],
      }
    }

    if (locationCount > 0) {
      return {
        status: 'partial',
        findings: [
          `${locationCount} named location(s) defined, but no enabled CA policy references them — locations alone do not control access`,
        ],
        recommendations: [
          'Create a CA policy that blocks or restricts access from untrusted locations',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No named locations defined and no location-based CA policies found'],
      recommendations: [
        'Define named locations for trusted networks (office IP ranges, VPN egress)',
        'Create a CA policy restricting access from outside managed access points',
      ],
    }
  },

  // Legacy authentication block — clientAppTypes legacy + block grant.
  evaluate_ca_legacy_auth_block: (_control, evidence) => {
    const caEvidence = findCaPolicies(evidence)
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }
    const enabled = enabledCaPolicies(caEvidence)
    const legacyBlock = enabled.filter((p) => {
      const apps: string[] = p?.conditions?.clientAppTypes ?? []
      const controls: string[] = p?.grantControls?.builtInControls ?? []
      const targetsLegacy = apps.includes('exchangeActiveSync') || apps.includes('other')
      return targetsLegacy && controls.includes('block')
    })

    if (legacyBlock.length > 0) {
      return {
        status: 'pass',
        findings: [
          `Legacy authentication is blocked by ${legacyBlock.length} enabled CA policy(ies): ${legacyBlock.map(policyName).join(', ')}`,
          'Modern authentication (OAuth 2.0 with cryptographically protected tokens) is therefore required',
        ],
        recommendations: [],
      }
    }

    return {
      status: 'fail',
      findings: [
        `${enabled.length} enabled CA policy(ies) inspected — none block legacy authentication clients`,
      ],
      recommendations: [
        'Create a CA policy targeting client apps "Exchange ActiveSync" and "Other clients" with a Block grant',
        'Legacy protocols (POP/IMAP/SMTP basic auth) bypass MFA and must be blocked',
      ],
    }
  },

  // Authentication strength — phishing-resistant MFA via CA authenticationStrength.
  evaluate_ca_auth_strength: (_control, evidence) => {
    const caEvidence = findCaPolicies(evidence)
    if (!caEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query Conditional Access policies'],
        recommendations: ['Verify Graph API permissions: Policy.Read.All'],
      }
    }
    const enabled = enabledCaPolicies(caEvidence)
    const strengthPolicies = enabled.filter((p) => p?.grantControls?.authenticationStrength != null)
    const mfaOnly = enabled.filter(policyHasMfaGrant)

    if (strengthPolicies.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${strengthPolicies.length} enabled CA policy(ies) enforce an Authentication Strength (phishing-resistant capable): ${strengthPolicies.map(policyName).join(', ')}`,
        ],
        recommendations: [
          'Confirm the strength definition includes only FIDO2, Windows Hello, or certificate-based methods',
        ],
      }
    }

    if (mfaOnly.length > 0) {
      return {
        status: 'partial',
        findings: [
          'MFA is enforced, but no CA policy uses an Authentication Strength — phishing-resistant methods are not specifically required',
        ],
        recommendations: [
          'Replace the generic "Require MFA" grant with a Phishing-resistant MFA authentication strength for privileged users first',
        ],
      }
    }

    return {
      status: 'fail',
      findings: ['No enabled CA policy enforces MFA or an authentication strength'],
      recommendations: [
        'Create a CA policy with the built-in "Phishing-resistant MFA" authentication strength',
      ],
    }
  },

  // Device inactivity lock timeout — reads the actual compliance policy setting.
  evaluate_device_lock_timeout: (_control, evidence) => {
    const ev = evidence.find((e) => e.endpoint.includes('deviceCompliance'))
    if (!ev?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance policies'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }
    const policies = ev.rawData as any[]
    const withTimeout = policies.filter((p) =>
      devicePolicySetting(
        p,
        /minutesofinactivitybeforelock/i,
        (v) => typeof v === 'number' && v > 0 && v <= 15
      )
    )
    const withAnyTimeout = policies.filter((p) =>
      devicePolicySetting(
        p,
        /minutesofinactivitybeforelock/i,
        (v) => typeof v === 'number' && v > 0
      )
    )

    if (withTimeout.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${withTimeout.length} compliance policy(ies) enforce an inactivity screen lock of ≤15 minutes: ${withTimeout.map(policyName).join(', ')}`,
        ],
        recommendations: [],
      }
    }

    if (withAnyTimeout.length > 0) {
      return {
        status: 'partial',
        findings: [
          `${withAnyTimeout.length} policy(ies) set an inactivity lock, but the timeout exceeds 15 minutes`,
        ],
        recommendations: ['Reduce passwordMinutesOfInactivityBeforeLock to 15 minutes or less'],
      }
    }

    return {
      status: 'fail',
      findings: [
        policies.length > 0
          ? `${policies.length} compliance policy(ies) exist but NONE configure an inactivity screen-lock timeout — policy existence alone does not satisfy this control`
          : 'No device compliance policies found',
      ],
      recommendations: [
        'Set "Maximum minutes of inactivity before password is required" to ≤15 in each platform compliance policy',
      ],
    }
  },

  // Device storage encryption — reads the actual BitLocker / storage encryption setting.
  evaluate_device_encryption: (_control, evidence) => {
    const ev = evidence.find((e) => e.endpoint.includes('deviceCompliance'))
    if (!ev?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance policies'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }
    const policies = ev.rawData as any[]
    const encryption = policies.filter((p) =>
      devicePolicySetting(
        p,
        /bitlockerenabled|storagerequireencryption|^encryptionrequired$/i,
        (v) => v === true
      )
    )

    if (encryption.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${encryption.length} compliance policy(ies) require device storage encryption (BitLocker/platform encryption): ${encryption.map(policyName).join(', ')}`,
        ],
        recommendations: [
          'Pair with a CA policy requiring compliant devices so unencrypted devices are blocked',
        ],
      }
    }

    return {
      status: 'fail',
      findings: [
        policies.length > 0
          ? `${policies.length} compliance policy(ies) exist but NONE require storage encryption — policy existence alone does not satisfy this control`
          : 'No device compliance policies found',
      ],
      recommendations: [
        'Enable "Require encryption of data storage on device" (BitLocker on Windows) in each platform compliance policy',
      ],
    }
  },

  // Device OS / patch currency — reads osMinimumVersion from compliance policies.
  evaluate_device_os_updates: (_control, evidence) => {
    const ev = evidence.find((e) => e.endpoint.includes('deviceCompliance'))
    if (!ev?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance policies'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }
    const policies = ev.rawData as any[]
    const withMinOs = policies.filter((p) =>
      devicePolicySetting(p, /osminimumversion/i, (v) => typeof v === 'string' && v.length > 0)
    )

    if (withMinOs.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${withMinOs.length} compliance policy(ies) enforce a minimum OS version, blocking unpatched devices: ${withMinOs.map(policyName).join(', ')}`,
        ],
        recommendations: [
          'Raise the minimum OS version after each Patch Tuesday cycle to keep the patch SLA enforced',
        ],
      }
    }

    return {
      status: 'fail',
      findings: [
        policies.length > 0
          ? `${policies.length} compliance policy(ies) exist but NONE set a minimum OS version — patch currency is not being enforced`
          : 'No device compliance policies found',
      ],
      recommendations: [
        'Set osMinimumVersion in each platform compliance policy',
        'Deploy Windows Update for Business rings to automate patch deployment',
      ],
    }
  },

  // Device antivirus / Defender enforcement — reads the actual AV settings.
  evaluate_device_av: (_control, evidence) => {
    const ev = evidence.find((e) => e.endpoint.includes('deviceCompliance'))
    if (!ev?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query device compliance policies'],
        recommendations: ['Verify Graph API permissions: DeviceManagementConfiguration.Read.All'],
      }
    }
    const policies = ev.rawData as any[]
    const withAv = policies.filter((p) =>
      devicePolicySetting(
        p,
        /defenderenabled|antivirusrequired|antispywarerequired|rtpenabled/i,
        (v) => v === true
      )
    )

    if (withAv.length > 0) {
      return {
        status: 'pass',
        findings: [
          `${withAv.length} compliance policy(ies) require active antivirus/Defender protection: ${withAv.map(policyName).join(', ')}`,
        ],
        recommendations: ['Verify Defender for Endpoint onboarding covers all device platforms'],
      }
    }

    return {
      status: 'fail',
      findings: [
        policies.length > 0
          ? `${policies.length} compliance policy(ies) exist but NONE require antivirus/Defender to be active — malware protection is not being enforced`
          : 'No device compliance policies found',
      ],
      recommendations: [
        'Enable "Microsoft Defender Antimalware" and "Real-time protection" requirements in Windows compliance policies',
      ],
    }
  },

  // PIM just-in-time privileged access — eligible (JIT) vs standing assignments.
  evaluate_pim_jit: (_control, evidence) => {
    const eligEvidence = evidence.find((e) => e.endpoint.includes('roleEligibility'))
    const standingEvidence = evidence.find((e) => e.endpoint.includes('roleAssignments'))

    if (!eligEvidence?.success && !standingEvidence?.success) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query PIM role eligibility or role assignments'],
        recommendations: ['Verify Graph API permissions: RoleManagement.Read.Directory'],
      }
    }

    const eligibleCount = eligEvidence?.success ? eligEvidence.recordCount : 0
    const standingCount = standingEvidence?.success ? standingEvidence.recordCount : 0

    if (eligibleCount > 0) {
      return {
        status: standingCount > eligibleCount ? 'partial' : 'pass',
        findings: [
          `${eligibleCount} PIM-eligible (just-in-time) role assignment(s) found — privileged access requires activation`,
          `${standingCount} standing (always-active) role assignment(s) remain`,
        ],
        recommendations:
          standingCount > eligibleCount
            ? [
                'Convert standing privileged assignments to PIM-eligible; keep only break-glass accounts permanent',
              ]
            : ['Review PIM activation settings: require MFA + justification on activation'],
      }
    }

    if (eligEvidence?.success && eligibleCount === 0) {
      return {
        status: 'fail',
        findings: [
          'PIM query succeeded but returned no eligible assignments — all privileged access appears to be standing (always-on), not just-in-time',
        ],
        recommendations: [
          'Enable Privileged Identity Management and convert privileged roles to eligible assignments',
          'Require MFA, justification, and time-boxed activation for privileged roles',
        ],
      }
    }

    // Eligibility endpoint failed but standing assignments visible
    return {
      status: 'partial',
      findings: [
        `${standingCount} role assignment(s) found, but PIM eligibility could not be queried — JIT activation cannot be confirmed`,
      ],
      recommendations: [
        'Grant RoleEligibilitySchedule.Read.Directory or verify PIM licensing (Entra ID P2)',
      ],
    }
  },

  // Organization security notification contacts — reads the actual contact
  // fields on the organization object (which always returns a record, so
  // existence alone proves nothing).
  evaluate_org_security_contacts: (_control, evidence) => {
    const orgEvidence = evidence.find((e) => e.endpoint.includes('/organization'))
    if (!orgEvidence?.success || orgEvidence.recordCount === 0) {
      return {
        status: 'not_assessed',
        findings: ['Unable to query the organization profile'],
        recommendations: ['Verify Graph API permissions: Organization.Read.All'],
      }
    }
    const org = (orgEvidence.rawData as any[])[0] ?? {}
    const securityMails: string[] = org.securityComplianceNotificationMails ?? []
    const securityPhones: string[] = org.securityComplianceNotificationPhones ?? []
    const technicalMails: string[] = org.technicalNotificationMails ?? []
    const hasSecurityContact = securityMails.length > 0 || securityPhones.length > 0
    const hasTechnicalContact = technicalMails.length > 0

    if (hasSecurityContact && hasTechnicalContact) {
      return {
        status: 'pass',
        findings: [
          `Security/compliance notification contact(s) configured: ${[...securityMails, ...securityPhones].join(', ')}`,
          `Technical notification contact(s) configured: ${technicalMails.join(', ')}`,
        ],
        recommendations: ['Verify the contacts are monitored distribution lists, not individuals'],
      }
    }

    if (hasSecurityContact || hasTechnicalContact) {
      return {
        status: 'partial',
        findings: [
          hasSecurityContact
            ? 'Security/compliance contacts configured, but no technical notification contact'
            : 'Technical contact configured, but no security/compliance notification contact',
        ],
        recommendations: [
          'Configure both security/compliance and technical notification contacts in the organization profile',
        ],
      }
    }

    return {
      status: 'fail',
      findings: [
        'Organization profile has NO security, compliance, or technical notification contacts configured — Microsoft cannot reach the organization about security incidents',
      ],
      recommendations: [
        'Set security compliance notification email/phone and technical notification email in the Microsoft 365 organization profile',
      ],
    }
  },

  // Platform-inherited control — satisfied by documented, always-on Microsoft
  // platform behavior that tenant configuration cannot disable. The pass is
  // honest because the basis is the platform itself, stated explicitly.
  evaluate_platform_inherited: (control, _evidence) => {
    return {
      status: 'pass',
      findings: [
        `Satisfied through Microsoft platform inheritance: ${control.evaluationCriteria.passingCondition}`,
        'This behavior is enforced by the Microsoft cloud platform and cannot be disabled by tenant configuration.',
      ],
      recommendations: [
        'Record this control as "inherited from Microsoft" in your SSP / shared-responsibility matrix, citing the Microsoft Product Placemat or FedRAMP package',
      ],
    }
  },

  // Proxy-signal control — automated evidence SUPPORTS but cannot fully verify
  // the requirement. Caps at partial so the report never over-claims; full
  // credit requires attestation or document evidence.
  evaluate_proxy_signal: (control, evidence) => {
    const successful = evidence.filter((e) => e.success)
    if (successful.length === 0) {
      return {
        status: 'not_assessed',
        findings: ['Unable to collect supporting evidence for this control'],
        recommendations: ['Verify the Graph API permissions listed for this control'],
      }
    }

    const withRecords = successful.filter((e) => e.recordCount > 0)
    if (withRecords.length === 0) {
      return {
        status: 'fail',
        findings: [
          'No supporting automated signals found for this control',
          `Requirement: ${control.evaluationCriteria.passingCondition}`,
        ],
        recommendations: [
          'Implement the required capability, then attach process documentation via the evidence workflow',
        ],
      }
    }

    return {
      status: 'partial',
      findings: [
        ...withRecords.map(
          (e) => `Supporting signal: ${e.queryDescription} (${e.recordCount} record(s))`
        ),
        `IMPORTANT: these signals support but do not fully verify the requirement — "${control.evaluationCriteria.passingCondition}" includes process or configuration elements that Microsoft Graph cannot confirm. Full credit requires attestation or document evidence.`,
      ],
      recommendations: [
        'Attach the relevant policy/process documentation via the evidence upload workflow to claim full credit',
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
      const policies = deviceEvidence.rawData as any[]
      const named = policies.map((p) => {
        const platform = (p?.['@odata.type'] ?? '')
          .replace('#microsoft.graph.', '')
          .replace('CompliancePolicy', '')
        return platform ? `${policyName(p)} [${platform}]` : policyName(p)
      })
      return {
        status: 'pass',
        findings: [
          `${deviceEvidence.recordCount} device compliance policy(ies) configured: ${named.join(', ')}`,
        ],
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
      // Verify the records actually carry attribution fields — a log that
      // cannot attribute actions to an individual does not satisfy audit
      // and accountability controls.
      const sample = (auditEvidence.rawData as any[])[0] ?? {}
      const keys = Object.keys(sample).map((k) => k.toLowerCase())
      const flat = JSON.stringify(sample).toLowerCase()
      const hasActor =
        keys.some((k) => k.includes('userprincipalname') || k === 'userid') ||
        flat.includes('userprincipalname') ||
        flat.includes('initiatedby')
      const hasTimestamp = keys.some(
        (k) => k.includes('datetime') || k.includes('timestamp') || k.includes('activitydate')
      )

      if (hasActor && hasTimestamp) {
        return {
          status: 'pass',
          findings: [
            `Audit logging is active — ${auditEvidence.recordCount} record(s) sampled`,
            'Records carry actor identity and timestamp fields, sufficient to attribute actions to individual users',
          ],
          recommendations: [
            'Verify audit log retention meets your framework requirements',
            'Consider exporting to SIEM for long-term retention',
          ],
        }
      }

      return {
        status: 'partial',
        findings: [
          `Audit records are being generated (${auditEvidence.recordCount} sampled), but actor/timestamp attribution fields could not be confirmed in the sampled records`,
        ],
        recommendations: [
          'Verify unified audit log entries include user identity, timestamp, and source for every event type in scope',
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
