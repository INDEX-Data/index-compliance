// =============================================================================
// INDEX ATLAS — Identity Remediation Agent (Sprint 1, IND-54)
// Handles: MFA enforcement, Conditional Access, auth methods, guest access
// Required Graph scopes: Policy.ReadWrite.ConditionalAccess,
//   Policy.ReadWrite.AuthenticationMethod, Policy.ReadWrite.AuthorizationPolicy
// =============================================================================

import { BaseAgent } from './base-agent.js'
import type { RemediationAction } from './base-agent.js'
import type { WriteOpts } from './types.js'
import type { ControlAssessment } from '../types.js'
import type { GraphClient } from '../services/graph-client.js'

const IDENTITY_FAMILIES = ['Identification and Authentication', 'Access Control']

const ATLAS_CA_MFA_POLICY_NAME = 'ATLAS - Require MFA for All Users'

export class IdentityAgent extends BaseAgent {
  readonly agentType = 'identity' as const

  readonly requiredScopes = [
    'Policy.ReadWrite.ConditionalAccess',
    'Policy.ReadWrite.AuthenticationMethod',
    'Policy.ReadWrite.AuthorizationPolicy',
    'Policy.Read.All',
  ]

  async plan(assessments: ControlAssessment[]): Promise<RemediationAction[]> {
    const failed = assessments.filter(
      (a) => (a.status === 'fail' || a.status === 'partial') && IDENTITY_FAMILIES.includes(a.family)
    )
    if (failed.length === 0) return []

    const actions: RemediationAction[] = []
    const seenActions = new Set<string>()

    for (const assessment of failed) {
      const { controlId } = assessment

      // MFA enforcement — IA.L2-3.5.3 and anything using evaluate_mfa_enforcement
      if (
        controlId === 'IA.L2-3.5.3' ||
        controlId === 'IA.L2-3.5.2' ||
        controlId === 'AC.L2-3.1.1'
      ) {
        if (!seenActions.has('require-mfa-ca')) {
          seenActions.add('require-mfa-ca')
          const hasMfaPolicy = this.detectMfaPolicy(assessment)

          if (!hasMfaPolicy) {
            actions.push(this.buildCreateMfaCAPolicy(controlId))
          } else {
            const disabledPolicyId = this.detectDisabledMfaPolicy(assessment)
            if (disabledPolicyId) {
              actions.push(this.buildEnableReportOnlyCA(controlId, disabledPolicyId))
            }
          }
        }
      }

      // Phishing-resistant auth methods — IA.L2-3.5.4
      if (controlId === 'IA.L2-3.5.4' && !seenActions.has('enable-phishing-resistant-auth')) {
        seenActions.add('enable-phishing-resistant-auth')
        actions.push(this.buildEnableAuthenticatorAction(controlId))
      }

      // Guest invite restrictions — AC.L2-3.1.20
      if (controlId === 'AC.L2-3.1.20' && !seenActions.has('restrict-guest-invites')) {
        seenActions.add('restrict-guest-invites')
        actions.push(this.buildRestrictGuestInvitesAction(controlId))
      }

      // Legacy auth block — IA.L2-3.5.10
      if (controlId === 'IA.L2-3.5.10' && !seenActions.has('block-legacy-auth')) {
        seenActions.add('block-legacy-auth')
        actions.push(this.buildBlockLegacyAuthAction(controlId))
      }
    }

    return actions
  }

  async dryRun(action: RemediationAction): Promise<{ preview: unknown; warnings: string[] }> {
    const warnings: string[] = []

    if (action.graphOperation.method === 'POST' && action.graphOperation.endpoint.includes('conditionalAccess')) {
      // Check if a similar policy already exists
      let existing: unknown[] = []
      try {
        existing = await this.graphClient.getConditionalAccessPolicies()
      } catch {
        warnings.push('Could not read existing Conditional Access policies — check Policy.Read.All consent')
        return { preview: action.graphOperation.payload, warnings }
      }

      const existingMfa = (existing as Array<{ displayName?: string }>).filter(
        (p) => p.displayName?.toLowerCase().includes('mfa') || p.displayName?.toLowerCase().includes('atlas')
      )
      if (existingMfa.length > 0) {
        warnings.push(
          `Found ${existingMfa.length} existing MFA-related CA polic${existingMfa.length === 1 ? 'y' : 'ies'}: ${existingMfa.map((p) => p.displayName).join(', ')}. Review before proceeding.`
        )
      }

      const preview = {
        willCreate: action.graphOperation.payload,
        existingPoliciesCount: (existing as unknown[]).length,
        existingMfaPolicies: existingMfa,
        deployedAs: 'report-only — no enforcement until a second approval',
      }
      return { preview, warnings }
    }

    return { preview: action.graphOperation.payload, warnings }
  }

  async execute(
    action: RemediationAction,
    approvedBy: string,
    assessmentId: string
  ): Promise<unknown> {
    const opts = this.buildWriteOpts(action, approvedBy, assessmentId, false)
    const { method, endpoint, payload } = action.graphOperation

    if (method === 'POST') return this.graphClient.post(endpoint, payload, opts)
    if (method === 'PATCH') return this.graphClient.patch(endpoint, payload, opts)
    if (method === 'DELETE') {
      await this.graphClient.delete(endpoint, opts)
      return null
    }
    throw new Error(`Unexpected method: ${method}`)
  }

  async rollback(
    action: RemediationAction,
    approvedBy: string,
    assessmentId: string
  ): Promise<unknown> {
    const opts = this.buildWriteOpts(action, approvedBy, assessmentId, false)
    const { method, endpoint, payload } = action.rollback

    if (method === 'DELETE') {
      await this.graphClient.delete(endpoint, opts)
      return null
    }
    if (method === 'PATCH') return this.graphClient.patch(endpoint, payload, opts)
    if (method === 'POST') return this.graphClient.post(endpoint, payload, opts)
    throw new Error(`Unexpected rollback method: ${method}`)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildWriteOpts(
    action: RemediationAction,
    approvedBy: string,
    assessmentId: string,
    dryRun: boolean
  ): WriteOpts {
    return {
      dryRun,
      requiredScopes: action.graphOperation.requiredPermissions,
      idempotencyKey: action.id,
      auditContext: {
        agentType: this.agentType,
        actionId: action.id,
        approvedBy,
        assessmentId,
      },
    }
  }

  private detectMfaPolicy(assessment: ControlAssessment): boolean {
    const caPolicies = this.extractEvidenceData<{ grantControls?: { builtInControls?: string[] }; state?: string }>(
      assessment,
      'conditionalAccess'
    )
    return caPolicies.some(
      (p) =>
        p.grantControls?.builtInControls?.includes('mfa') &&
        (p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced')
    )
  }

  private detectDisabledMfaPolicy(assessment: ControlAssessment): string | null {
    const caPolicies = this.extractEvidenceData<{ id?: string; grantControls?: { builtInControls?: string[] }; state?: string }>(
      assessment,
      'conditionalAccess'
    )
    const disabled = caPolicies.find(
      (p) => p.grantControls?.builtInControls?.includes('mfa') && p.state === 'disabled' && p.id
    )
    return disabled?.id ?? null
  }

  private extractEvidenceData<T>(assessment: ControlAssessment, category: string): T[] {
    for (const ev of assessment.evidenceCollected) {
      if (ev.endpoint?.includes(this.categoryToEndpointFragment(category)) && ev.rawData) {
        return ev.rawData as T[]
      }
    }
    return []
  }

  private categoryToEndpointFragment(category: string): string {
    const map: Record<string, string> = {
      conditionalAccess: 'conditionalAccess/policies',
      authMethods: 'authenticationMethodsPolicy',
    }
    return map[category] ?? category
  }

  // ---------------------------------------------------------------------------
  // Action builders
  // ---------------------------------------------------------------------------

  private buildCreateMfaCAPolicy(controlId: string): RemediationAction {
    const id = `identity-mfa-ca-create-${controlId}`
    return {
      id,
      controlId,
      title: 'Require MFA for All Users (Report-Only)',
      description:
        'Creates a Conditional Access policy that requires Multi-Factor Authentication for all users and all cloud apps. Deployed in report-only mode — no enforcement until a second approval step.',
      agentType: this.agentType,
      graphOperation: {
        method: 'POST',
        endpoint: '/identity/conditionalAccess/policies',
        payload: {
          displayName: ATLAS_CA_MFA_POLICY_NAME,
          state: 'enabledForReportingButNotEnforced',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
          },
          grantControls: {
            operator: 'OR',
            builtInControls: ['mfa'],
          },
        },
        requiredPermissions: ['Policy.ReadWrite.ConditionalAccess'],
      },
      riskLevel: 'low',
      autoApprovable: false,
      rollback: {
        method: 'DELETE',
        endpoint: '/identity/conditionalAccess/policies/{createdPolicyId}',
      },
      preconditions: [
        'Entra ID P1 or P2 license required for Conditional Access',
        'Policy.ReadWrite.ConditionalAccess admin consent granted',
      ],
      impact:
        'Creates a new CA policy in report-only mode. Zero user impact until enforcement is separately approved.',
    }
  }

  private buildEnableReportOnlyCA(controlId: string, policyId: string): RemediationAction {
    const id = `identity-mfa-ca-enable-${policyId}`
    return {
      id,
      controlId,
      title: 'Enable MFA Conditional Access Policy (Report-Only)',
      description:
        `Switches the existing disabled MFA CA policy (${policyId}) to report-only mode so it becomes active for monitoring without enforcing.`,
      agentType: this.agentType,
      graphOperation: {
        method: 'PATCH',
        endpoint: `/identity/conditionalAccess/policies/${policyId}`,
        payload: { state: 'enabledForReportingButNotEnforced' },
        requiredPermissions: ['Policy.ReadWrite.ConditionalAccess'],
      },
      riskLevel: 'low',
      autoApprovable: false,
      rollback: {
        method: 'PATCH',
        endpoint: `/identity/conditionalAccess/policies/${policyId}`,
        payload: { state: 'disabled' },
      },
      impact: 'Sets policy to report-only. No user interruption — monitoring begins immediately.',
    }
  }

  private buildEnableAuthenticatorAction(controlId: string): RemediationAction {
    const id = `identity-auth-methods-authenticator-${controlId}`
    return {
      id,
      controlId,
      title: 'Enable Microsoft Authenticator (Number Matching)',
      description:
        'Enables Microsoft Authenticator with number matching in the Authentication Methods Policy. Phishing-resistant and replay-resistant per IA.L2-3.5.4.',
      agentType: this.agentType,
      graphOperation: {
        method: 'PATCH',
        endpoint:
          '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/microsoftAuthenticator',
        payload: {
          state: 'enabled',
          featureSettings: {
            displayAppInformationRequiredState: { state: 'enabled', includeTarget: { targetType: 'group', id: 'all_users' } },
            numberMatchingRequiredState: { state: 'enabled', includeTarget: { targetType: 'group', id: 'all_users' } },
          },
        },
        requiredPermissions: ['Policy.ReadWrite.AuthenticationMethod'],
      },
      riskLevel: 'low',
      autoApprovable: false,
      rollback: {
        method: 'PATCH',
        endpoint:
          '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/microsoftAuthenticator',
        payload: { state: 'disabled' },
      },
      impact: 'Enables Authenticator app with number matching. Existing users must approve number matches on sign-in.',
    }
  }

  private buildRestrictGuestInvitesAction(controlId: string): RemediationAction {
    const id = `identity-guest-restrict-${controlId}`
    return {
      id,
      controlId,
      title: 'Restrict Guest Invitations to Admins Only',
      description:
        'Sets the authorization policy so only admins and guest inviters can invite external users (B2B). Prevents any employee from adding external identities.',
      agentType: this.agentType,
      graphOperation: {
        method: 'PATCH',
        endpoint: '/policies/authorizationPolicy',
        payload: { allowInvitesFrom: 'adminsAndGuestInviters' },
        requiredPermissions: ['Policy.ReadWrite.AuthorizationPolicy'],
      },
      riskLevel: 'medium',
      autoApprovable: false,
      rollback: {
        method: 'PATCH',
        endpoint: '/policies/authorizationPolicy',
        payload: { allowInvitesFrom: 'adminsGuestInvitersAndAllMembers' },
      },
      impact: 'Employees can no longer invite external guests. Only admins and users in the Guest Inviter role can.',
    }
  }

  private buildBlockLegacyAuthAction(controlId: string): RemediationAction {
    const id = `identity-block-legacy-auth-${controlId}`
    return {
      id,
      controlId,
      title: 'Block Legacy Authentication Protocols (Report-Only)',
      description:
        'Creates a CA policy blocking legacy auth clients (Exchange ActiveSync, IMAP, POP3, SMTP Auth) in report-only mode. Legacy protocols cannot enforce MFA.',
      agentType: this.agentType,
      graphOperation: {
        method: 'POST',
        endpoint: '/identity/conditionalAccess/policies',
        payload: {
          displayName: 'ATLAS - Block Legacy Authentication',
          state: 'enabledForReportingButNotEnforced',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
            clientAppTypes: ['exchangeActiveSync', 'other'],
          },
          grantControls: {
            operator: 'OR',
            builtInControls: ['block'],
          },
        },
        requiredPermissions: ['Policy.ReadWrite.ConditionalAccess'],
      },
      riskLevel: 'medium',
      autoApprovable: false,
      rollback: {
        method: 'DELETE',
        endpoint: '/identity/conditionalAccess/policies/{createdPolicyId}',
      },
      preconditions: ['Verify no critical workflows rely on legacy auth before enforcing'],
      impact:
        'Report-only — monitors legacy auth usage. Review the report before switching to enforcement mode.',
    }
  }
}
