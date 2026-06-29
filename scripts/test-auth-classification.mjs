// =============================================================================
// Auth-classification + fail-fast tests
//
// Proves the loud-failure path WITHOUT needing live Azure:
//   1. classifyTokenError maps each credential-class AADSTS code (and
//      invalid_client) to a GraphAuthError with the right code + userMessage,
//      and returns null for non-credential failures.
//   2. A GraphClient whose token endpoint returns AADSTS7000215 throws
//      GraphAuthError from verifyConnection().
//   3. runAssessment aborts on that GraphAuthError — calls onError, never
//      onComplete, and saves no report.
//
// Run after `npm run build`:  node scripts/test-auth-classification.mjs
// =============================================================================
import { GraphClient, GraphAuthError, classifyTokenError } from '../dist/services/graph-client.js'
import { runAssessment } from '../dist/operations/assess.js'

let passed = 0
let failed = 0
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

// ── 1. classifyTokenError ────────────────────────────────────────────────────
console.log('classifyTokenError')
const body7000215 = JSON.stringify({
  error: 'invalid_client',
  error_description: "AADSTS7000215: Invalid client secret provided. ...",
  error_codes: [7000215],
})
const e1 = classifyTokenError(401, body7000215)
check('AADSTS7000215 → GraphAuthError', e1 instanceof GraphAuthError)
check('AADSTS7000215 code preserved', e1?.code === 'AADSTS7000215', e1?.code)
check('AADSTS7000215 userMessage mentions secret', /secret/i.test(e1?.userMessage ?? ''))

check('AADSTS7000222 (expired) classified', classifyTokenError(401, 'AADSTS7000222 expired')?.code === 'AADSTS7000222')
check('AADSTS700016 (app not found) classified', classifyTokenError(400, 'AADSTS700016 not found')?.code === 'AADSTS700016')
check('AADSTS90002 (tenant not found) classified', classifyTokenError(400, 'AADSTS90002 tenant')?.code === 'AADSTS90002')

const eInvalidClient = classifyTokenError(401, JSON.stringify({ error: 'invalid_client', error_description: 'no AADSTS code here' }))
check('bare invalid_client (401) classified', eInvalidClient?.code === 'invalid_client')

check('non-credential 403 → null (falls back to generic)', classifyTokenError(403, 'Authorization_RequestDenied') === null)
check('throttling 429 → null', classifyTokenError(429, 'AADSTS900000 throttled-ish but not credential') === null)

// ── 2. verifyConnection throws GraphAuthError ────────────────────────────────
console.log('GraphClient.verifyConnection (mocked fetch)')
const realFetch = globalThis.fetch
globalThis.fetch = async (url) => {
  if (String(url).includes('/oauth2/v2.0/token')) {
    return new Response(body7000215, { status: 401 })
  }
  return new Response('{}', { status: 200 })
}
const client = new GraphClient({
  tenantId: 'fake-tenant',
  clientId: 'fake-client',
  clientSecret: 'fake-bad-secret',
  scopes: ['https://graph.microsoft.com/.default'],
})
let thrown = null
try { await client.verifyConnection() } catch (e) { thrown = e }
check('verifyConnection throws GraphAuthError', thrown instanceof GraphAuthError, thrown?.constructor?.name)
check('thrown error carries actionable userMessage', /reconnect/i.test(thrown?.userMessage ?? ''))

// ── 3. runAssessment aborts (onError, no onComplete, no report) ───────────────
console.log('runAssessment fail-fast')
let onErrorMsg = null
let onCompleteCalled = false
let progressCount = 0
let returned = 'NOT_THROWN'
try {
  await runAssessment(
    { frameworkId: 'CMMC_L2', graphClient: client, clientId: 'c1', clientName: 'Test', tenantId: 'fake-tenant' },
    {
      onError: async (e) => { onErrorMsg = e.message },
      onComplete: async () => { onCompleteCalled = true },
      onProgress: async () => { progressCount++ },
    }
  )
} catch (e) {
  returned = e?.message ?? 'threw'
}
check('runAssessment threw (did not resolve a report)', returned !== 'NOT_THROWN')
check('onError called with actionable message', /reconnect/i.test(onErrorMsg ?? ''), onErrorMsg)
check('onComplete NEVER called', onCompleteCalled === false)
check('no per-control progress emitted (aborted before loop)', progressCount === 0, `progressCount=${progressCount}`)

globalThis.fetch = realFetch

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
