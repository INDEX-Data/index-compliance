// =============================================================================
// Evaluator fixture tests — feeds synthetic Graph payloads to each evaluator
// and asserts the verdict. Run after `npm run build`:
//   node scripts/test-evaluators.mjs
// =============================================================================
import { getEvaluator } from '../dist/services/compliance-engine.js'

let passed = 0
let failed = 0

function ev(endpoint, rawData, success = true) {
  return {
    queryId: 'q',
    queryDescription: `query ${endpoint}`,
    endpoint,
    rawData,
    recordCount: rawData.length,
    collectedAt: new Date().toISOString(),
    success,
  }
}

const CONTROL = {
  controlId: 'TEST-1',
  title: 'Test control',
  description: '',
  frameworkId: 'CMMC_L2',
  family: 'Test',
  evidenceQueries: [],
  evaluationCriteria: { type: 'custom', passingCondition: 'the specific requirement text', customEvaluator: '' },
}

function check(name, evaluatorName, evidence, expectedStatus) {
  const result = getEvaluator(evaluatorName)(CONTROL, evidence)
  if (result.status === expectedStatus) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.error(`  FAIL ${name}: expected ${expectedStatus}, got ${result.status}`)
    console.error(`       findings: ${result.findings.join(' | ')}`)
  }
}

const CA = '/identity/conditionalAccess/policies'
const LOC = '/identity/conditionalAccess/namedLocations'
const DEV = '/deviceManagement/deviceCompliancePolicies'

// ── evaluate_mfa_enforcement ─────────────────────────────────────────────────
console.log('evaluate_mfa_enforcement')
check('enabled MFA policy targeting All users → pass', 'evaluate_mfa_enforcement',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] }, conditions: { users: { includeUsers: ['All'] } } }])],
  'pass')
check('enabled MFA policy scoped to a group → partial', 'evaluate_mfa_enforcement',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] }, conditions: { users: { includeUsers: ['group-id'] } } }])],
  'partial')
check('report-only MFA policy → partial (NOT pass)', 'evaluate_mfa_enforcement',
  [ev(CA, [{ state: 'enabledForReportingButNotEnforced', grantControls: { builtInControls: ['mfa'] }, conditions: { users: { includeUsers: ['All'] } } }])],
  'partial')
check('disabled MFA policy → fail (NOT pass)', 'evaluate_mfa_enforcement',
  [ev(CA, [{ state: 'disabled', grantControls: { builtInControls: ['mfa'] } }])],
  'fail')
check('policies exist but none require MFA → fail', 'evaluate_mfa_enforcement',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['compliantDevice'] } }])],
  'fail')
check('query failed → not_assessed', 'evaluate_mfa_enforcement',
  [ev(CA, [], false)],
  'not_assessed')

// ── evaluate_ca_session_controls ─────────────────────────────────────────────
console.log('evaluate_ca_session_controls')
check('sign-in frequency enforced → pass', 'evaluate_ca_session_controls',
  [ev(CA, [{ state: 'enabled', sessionControls: { signInFrequency: { isEnabled: true, value: 8, type: 'hours' } } }])],
  'pass')
check('only persistent browser restriction → partial', 'evaluate_ca_session_controls',
  [ev(CA, [{ state: 'enabled', sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' } } }])],
  'partial')
check('MFA policy without session controls → fail (the old false-pass case)', 'evaluate_ca_session_controls',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] } }])],
  'fail')

// ── evaluate_ca_terms_of_use ─────────────────────────────────────────────────
console.log('evaluate_ca_terms_of_use')
check('ToU grant present → pass', 'evaluate_ca_terms_of_use',
  [ev(CA, [{ state: 'enabled', grantControls: { termsOfUse: ['tou-id-1'] } }])],
  'pass')
check('CA policies exist but no ToU → fail (the old false-pass case)', 'evaluate_ca_terms_of_use',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] } }])],
  'fail')

// ── evaluate_ca_compliant_device ─────────────────────────────────────────────
console.log('evaluate_ca_compliant_device')
check('compliantDevice grant → pass', 'evaluate_ca_compliant_device',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['compliantDevice'] } }])],
  'pass')
check('MFA-only policy → fail', 'evaluate_ca_compliant_device',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] } }])],
  'fail')

// ── evaluate_ca_named_locations ──────────────────────────────────────────────
console.log('evaluate_ca_named_locations')
check('locations defined AND referenced by policy → pass', 'evaluate_ca_named_locations',
  [ev(LOC, [{ displayName: 'HQ' }]),
   ev(CA, [{ state: 'enabled', conditions: { locations: { includeLocations: ['loc-1'] } } }])],
  'pass')
check('locations defined but no policy uses them → partial', 'evaluate_ca_named_locations',
  [ev(LOC, [{ displayName: 'HQ' }]),
   ev(CA, [{ state: 'enabled', conditions: {} }])],
  'partial')
check('no locations at all → fail', 'evaluate_ca_named_locations',
  [ev(LOC, []), ev(CA, [{ state: 'enabled', conditions: {} }])],
  'fail')

// ── evaluate_ca_legacy_auth_block ────────────────────────────────────────────
console.log('evaluate_ca_legacy_auth_block')
check('legacy clients blocked → pass', 'evaluate_ca_legacy_auth_block',
  [ev(CA, [{ state: 'enabled', conditions: { clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { builtInControls: ['block'] } }])],
  'pass')
check('MFA policy but legacy not blocked → fail', 'evaluate_ca_legacy_auth_block',
  [ev(CA, [{ state: 'enabled', conditions: { clientAppTypes: ['all'] }, grantControls: { builtInControls: ['mfa'] } }])],
  'fail')

// ── evaluate_ca_auth_strength ────────────────────────────────────────────────
console.log('evaluate_ca_auth_strength')
check('authentication strength enforced → pass', 'evaluate_ca_auth_strength',
  [ev(CA, [{ state: 'enabled', grantControls: { authenticationStrength: { id: 's-1', displayName: 'Phishing-resistant MFA' } } }])],
  'pass')
check('plain MFA only → partial (phishing-resistant not confirmed)', 'evaluate_ca_auth_strength',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: ['mfa'] } }])],
  'partial')
check('nothing → fail', 'evaluate_ca_auth_strength',
  [ev(CA, [{ state: 'enabled', grantControls: { builtInControls: [] } }])],
  'fail')

// ── evaluate_device_lock_timeout ─────────────────────────────────────────────
console.log('evaluate_device_lock_timeout')
check('timeout 15 min configured → pass', 'evaluate_device_lock_timeout',
  [ev(DEV, [{ '@odata.type': '#microsoft.graph.windows10CompliancePolicy', displayName: 'Win10', passwordMinutesOfInactivityBeforeLock: 15 }])],
  'pass')
check('timeout 60 min → partial', 'evaluate_device_lock_timeout',
  [ev(DEV, [{ displayName: 'Lax', passwordMinutesOfInactivityBeforeLock: 60 }])],
  'partial')
check('policies exist but no timeout → fail (the old false-pass case)', 'evaluate_device_lock_timeout',
  [ev(DEV, [{ displayName: 'NoLock', passwordRequired: true }])],
  'fail')

// ── evaluate_device_encryption ───────────────────────────────────────────────
console.log('evaluate_device_encryption')
check('BitLocker required → pass', 'evaluate_device_encryption',
  [ev(DEV, [{ displayName: 'Win10', bitLockerEnabled: true }])],
  'pass')
check('storageRequireEncryption (mobile) → pass', 'evaluate_device_encryption',
  [ev(DEV, [{ displayName: 'Android', storageRequireEncryption: true }])],
  'pass')
check('policies exist but no encryption requirement → fail', 'evaluate_device_encryption',
  [ev(DEV, [{ displayName: 'NoEnc', passwordRequired: true }])],
  'fail')

// ── evaluate_device_os_updates ───────────────────────────────────────────────
console.log('evaluate_device_os_updates')
check('osMinimumVersion set → pass', 'evaluate_device_os_updates',
  [ev(DEV, [{ displayName: 'Win10', osMinimumVersion: '10.0.19045' }])],
  'pass')
check('no min OS version → fail', 'evaluate_device_os_updates',
  [ev(DEV, [{ displayName: 'NoMin', passwordRequired: true }])],
  'fail')

// ── evaluate_device_av ───────────────────────────────────────────────────────
console.log('evaluate_device_av')
check('defenderEnabled → pass', 'evaluate_device_av',
  [ev(DEV, [{ displayName: 'Win10', defenderEnabled: true }])],
  'pass')
check('no AV requirement → fail', 'evaluate_device_av',
  [ev(DEV, [{ displayName: 'NoAV', passwordRequired: true }])],
  'fail')

// ── evaluate_pim_jit ─────────────────────────────────────────────────────────
console.log('evaluate_pim_jit')
check('eligible assignments, few standing → pass', 'evaluate_pim_jit',
  [ev('/roleManagement/directory/roleEligibilityScheduleInstances', [{ id: 'e1' }, { id: 'e2' }]),
   ev('/roleManagement/directory/roleAssignments', [{ id: 's1' }])],
  'pass')
check('more standing than eligible → partial', 'evaluate_pim_jit',
  [ev('/roleManagement/directory/roleEligibilityScheduleInstances', [{ id: 'e1' }]),
   ev('/roleManagement/directory/roleAssignments', [{ id: 's1' }, { id: 's2' }, { id: 's3' }])],
  'partial')
check('no eligible assignments at all → fail', 'evaluate_pim_jit',
  [ev('/roleManagement/directory/roleEligibilityScheduleInstances', []),
   ev('/roleManagement/directory/roleAssignments', [{ id: 's1' }])],
  'fail')

// ── evaluate_org_security_contacts ───────────────────────────────────────────
console.log('evaluate_org_security_contacts')
check('both contact types set → pass', 'evaluate_org_security_contacts',
  [ev('/organization', [{ securityComplianceNotificationMails: ['soc@x.com'], technicalNotificationMails: ['it@x.com'] }])],
  'pass')
check('only technical contact → partial', 'evaluate_org_security_contacts',
  [ev('/organization', [{ technicalNotificationMails: ['it@x.com'] }])],
  'partial')
check('org record exists but NO contacts → fail (the old false-pass case)', 'evaluate_org_security_contacts',
  [ev('/organization', [{ displayName: 'Acme' }])],
  'fail')

// ── evaluate_proxy_signal ────────────────────────────────────────────────────
console.log('evaluate_proxy_signal')
check('signals present → partial (NEVER pass)', 'evaluate_proxy_signal',
  [ev('/security/alerts', [{ id: 'a1' }])],
  'partial')
check('no signals → fail', 'evaluate_proxy_signal',
  [ev('/security/alerts', [])],
  'fail')
check('collection failed → not_assessed', 'evaluate_proxy_signal',
  [ev('/security/alerts', [], false)],
  'not_assessed')

// ── evaluate_platform_inherited ──────────────────────────────────────────────
console.log('evaluate_platform_inherited')
check('always pass with inheritance language', 'evaluate_platform_inherited', [], 'pass')

// ── evaluate_audit_logging (tightened) ───────────────────────────────────────
console.log('evaluate_audit_logging')
check('records with actor + timestamp → pass', 'evaluate_audit_logging',
  [ev('/auditLogs/directoryAudits', [{ userPrincipalName: 'a@x.com', activityDateTime: '2026-01-01T00:00:00Z' }])],
  'pass')
check('records without attribution fields → partial', 'evaluate_audit_logging',
  [ev('/auditLogs/directoryAudits', [{ someField: 'x' }])],
  'partial')
check('no records → fail', 'evaluate_audit_logging',
  [ev('/auditLogs/directoryAudits', [])],
  'fail')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
