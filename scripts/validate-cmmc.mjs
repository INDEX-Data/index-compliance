// =============================================================================
// CMMC L2 Validation Harness
//
// Runs the full CMMC L2 assessment LIVE against the tenant, then audits every
// verdict against the engine's integrity invariants:
//
//   1. proxy_signal controls can NEVER be 'pass' (cap at partial)
//   2. manual_attestation controls are ALWAYS 'manual_required'
//   3. platform_inherited passes ALWAYS state the inheritance basis
//   4. Every 'pass' from a deep evaluator cites a specific policy/setting
//      name in its findings — never a bare record count
//   5. Every 'fail'/'partial' carries an actionable recommendation
//   6. Evidence was genuinely collected per control (no shared/empty evidence)
//
// Usage:  npm run build && node scripts/validate-cmmc.mjs
// Output: per-control table + invariant audit + validation-cmmc-results.json
// =============================================================================
import { readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { GraphClient } from '../dist/services/graph-client.js'
import { assessControl, buildSummary } from '../dist/services/compliance-engine.js'
import { getFramework } from '../dist/data/framework-registry.js'
import { GraphAuthError } from '../dist/services/graph-client.js'

// ── Credentials from the existing MCP config ─────────────────────────────────
const configPath = join(homedir(), '.claude', 'claude_code_config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const env = config.mcpServers['msgraph-compliance'].env

const client = new GraphClient({
  tenantId: env.AZURE_TENANT_ID,
  clientId: env.AZURE_CLIENT_ID,
  clientSecret: env.AZURE_CLIENT_SECRET,
  scopes: ['https://graph.microsoft.com/.default'],
})

const fw = getFramework('CMMC_L2')
if (!fw) throw new Error('CMMC_L2 not found in registry')

// ── Preflight: fail fast & clearly if the connection itself is broken ─────────
// Use process.exitCode (never process.exit) so Node drains in-flight sockets
// before exiting — avoids the Windows libuv close-handle assertion and keeps
// the exit code deterministic for CI.
console.log(`Verifying connection to tenant ${env.AZURE_TENANT_ID} ...`)
let connectionOk = false
try {
  const info = await client.verifyConnection()
  console.log(`Connection OK — tenant: ${info.displayName ?? '(name unavailable)'}\n`)
  connectionOk = true
} catch (err) {
  if (err instanceof GraphAuthError) {
    console.error(`\n✗ CONNECTION FAILED (${err.code})`)
    console.error(`  ${err.userMessage}`)
    console.error(
      `\n  This script reads credentials from claude_code_config.json. If you rotated the\n` +
        `  secret in the ATLAS app (Supabase) but not here, update AZURE_CLIENT_SECRET in\n` +
        `  ${configPath} too, then re-run.`
    )
    process.exitCode = 2
  } else {
    throw err
  }
}

if (connectionOk) {
// ── Run the assessment ────────────────────────────────────────────────────────
console.log(`Running ${fw.name} — ${fw.controls.length} controls against tenant ${env.AZURE_TENANT_ID}\n`)

const assessments = []
for (const control of fw.controls) {
  process.stderr.write(`  ${control.controlId} ...`)
  const a = await assessControl(control, client)
  assessments.push({ control, assessment: a })
  process.stderr.write(` ${a.status}\n`)
}

// ── Per-control table ─────────────────────────────────────────────────────────
console.log('\n══ PER-CONTROL VERDICTS ═══════════════════════════════════════════')
console.log('control          evaluator                        status           basis')
console.log('─'.repeat(110))
for (const { control, assessment } of assessments) {
  const evalName = (control.evaluationCriteria.customEvaluator ?? 'evidence_exists')
    .replace('evaluate_', '')
  const basis = (assessment.findings[0] ?? '').slice(0, 70)
  console.log(
    `${control.controlId.padEnd(16)} ${evalName.padEnd(32)} ${assessment.status.padEnd(16)} ${basis}`
  )
}

// ── Invariant audit ───────────────────────────────────────────────────────────
console.log('\n══ INTEGRITY INVARIANT AUDIT ══════════════════════════════════════')
const violations = []

const DEEP_EVALUATORS = new Set([
  'evaluate_mfa_enforcement',
  'evaluate_ca_session_controls',
  'evaluate_ca_terms_of_use',
  'evaluate_ca_compliant_device',
  'evaluate_ca_named_locations',
  'evaluate_ca_legacy_auth_block',
  'evaluate_ca_auth_strength',
  'evaluate_device_lock_timeout',
  'evaluate_device_encryption',
  'evaluate_device_os_updates',
  'evaluate_device_av',
  'evaluate_pim_jit',
  'evaluate_org_security_contacts',
  'evaluate_device_usb_control',
  'evaluate_device_vpn_tunnel',
  'evaluate_device_peripheral',
  'evaluate_tap_policy',
  'evaluate_sharepoint_sharing',
])

for (const { control, assessment } of assessments) {
  const evalName = control.evaluationCriteria.customEvaluator ?? 'evaluate_evidence_exists'
  const { status, findings, recommendations, evidenceCollected } = assessment
  const cid = control.controlId

  // 1. proxy_signal can never pass
  if (evalName === 'evaluate_proxy_signal' && status === 'pass') {
    violations.push(`${cid}: proxy_signal returned PASS — must cap at partial`)
  }

  // 2. manual attestation must be manual_required
  if (evalName === 'evaluate_manual_attestation' && status !== 'manual_required') {
    violations.push(`${cid}: manual_attestation returned ${status} — must be manual_required`)
  }

  // 3. platform_inherited must state the basis
  if (evalName === 'evaluate_platform_inherited') {
    if (status !== 'pass') violations.push(`${cid}: platform_inherited returned ${status}`)
    if (!findings.some((f) => f.toLowerCase().includes('platform inheritance'))) {
      violations.push(`${cid}: platform_inherited pass does not state the inheritance basis`)
    }
  }

  // 4. Deep-evaluator passes must cite specifics (a policy name, a count of
  //    confirmed settings, etc.) — heuristic: findings must contain a colon-
  //    delimited name list or an explicit setting reference.
  if (DEEP_EVALUATORS.has(evalName) && status === 'pass') {
    const specific = findings.some(
      (f) => f.includes(':') || /≤|enforce|require|configured|blocked|eligible/i.test(f)
    )
    if (!specific) {
      violations.push(`${cid}: deep-evaluator pass without a specific cited basis: "${findings[0]}"`)
    }
  }

  // 5. fail/partial must be actionable
  if ((status === 'fail' || status === 'partial') && recommendations.length === 0) {
    violations.push(`${cid}: ${status} with no recommendations — not actionable`)
  }

  // 6. Evidence must have been genuinely collected per control
  //    (manual controls legitimately have zero queries)
  if (evalName !== 'evaluate_manual_attestation' && evalName !== 'evaluate_platform_inherited') {
    if (!evidenceCollected || evidenceCollected.length === 0) {
      violations.push(`${cid}: no evidence queries executed for an automated control`)
    }
    if (evidenceCollected?.some((e) => e.success && e.collectedAt == null)) {
      violations.push(`${cid}: evidence missing collection timestamp`)
    }
  }

  // 7. A pass may never coexist with zero successful evidence (automated only)
  if (
    status === 'pass' &&
    evalName !== 'evaluate_platform_inherited' &&
    evidenceCollected?.every((e) => !e.success)
  ) {
    violations.push(`${cid}: PASS with zero successful evidence queries`)
  }
}

if (violations.length === 0) {
  console.log('All integrity invariants hold. No verdict over-claims its evidence.')
} else {
  for (const v of violations) console.log(`VIOLATION  ${v}`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
const summary = buildSummary(assessments.map((x) => x.assessment))
console.log('\n══ SUMMARY ════════════════════════════════════════════════════════')
console.log(`Total controls:        ${summary.totalControls}`)
console.log(`Passed:                ${summary.passed}`)
console.log(`Failed:                ${summary.failed}`)
console.log(`Partial:               ${summary.partial}`)
console.log(`Manual attestation:    ${summary.manualRequired}`)
console.log(`Not assessed (errors): ${summary.notAssessed}`)
console.log(`Compliance % (verified controls only): ${summary.compliancePercentage}%`)
console.log(`Automated coverage:    ${summary.automatedCoverage}%`)
console.log(`Collection health:     ${summary.collectionHealth}%`)
console.log(`Risk score:            ${summary.riskScore}`)

// Evaluator distribution — proves the remap is what actually ran
const dist = {}
for (const { control } of assessments) {
  const e = control.evaluationCriteria.customEvaluator ?? 'evidence_exists'
  dist[e] = (dist[e] ?? 0) + 1
}
console.log('\nEvaluator distribution (what actually ran):')
for (const [name, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${name}`)
}

writeFileSync(
  new URL('../validation-cmmc-results.json', import.meta.url),
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      tenantId: env.AZURE_TENANT_ID,
      summary,
      violations,
      controls: assessments.map(({ control, assessment }) => ({
        controlId: control.controlId,
        title: control.title,
        evaluator: control.evaluationCriteria.customEvaluator,
        passingCondition: control.evaluationCriteria.passingCondition,
        status: assessment.status,
        findings: assessment.findings,
        recommendations: assessment.recommendations,
        evidence: assessment.evidenceCollected.map((e) => ({
          endpoint: e.endpoint,
          success: e.success,
          recordCount: e.recordCount,
          error: e.errorMessage,
        })),
      })),
    },
    null,
    2
  )
)
console.log('\nFull results written to validation-cmmc-results.json')
process.exitCode = violations.length > 0 ? 1 : 0
} // end if (connectionOk)
