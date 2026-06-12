// One-time remap: point each CMMC L2 control at the evaluator that actually
// verifies its passingCondition. Run: node scripts/remap-cmmc-evaluators.mjs
import { readFileSync, writeFileSync } from 'fs'

const FILE = new URL('../src/data/cmmc-l2-controls.ts', import.meta.url)

// controlId → correct evaluator.
// Categories:
//   deep        — new evaluator verifies the specific setting (full pass possible)
//   platform    — always-on Microsoft platform behavior (honest inherited pass)
//   proxy       — signals support but can't fully verify → caps at partial
//   manual      — documentation/process control → manual_required (attestation)
const MAP = {
  // ── Access Control ─────────────────────────────────────────────
  'AC.L2-3.1.8': 'evaluate_platform_inherited', // Azure AD Smart Lockout — always on
  'AC.L2-3.1.9': 'evaluate_ca_terms_of_use',
  'AC.L2-3.1.10': 'evaluate_device_lock_timeout',
  'AC.L2-3.1.11': 'evaluate_ca_session_controls',
  'AC.L2-3.1.12': 'evaluate_policy_exists', // CA controls + sign-in logs both verified
  'AC.L2-3.1.13': 'evaluate_ca_compliant_device',
  'AC.L2-3.1.14': 'evaluate_ca_named_locations',
  'AC.L2-3.1.15': 'evaluate_pim_jit',
  'AC.L2-3.1.16': 'evaluate_ca_compliant_device',
  'AC.L2-3.1.17': 'evaluate_proxy_signal', // wireless encryption settings not in compliance payloads
  'AC.L2-3.1.18': 'evaluate_ca_compliant_device',
  'AC.L2-3.1.19': 'evaluate_device_encryption',
  'AC.L2-3.1.21': 'evaluate_proxy_signal', // USB control settings live in varied config profile schemas

  // ── Awareness & Training ───────────────────────────────────────
  'AT.L2-3.2.1': 'evaluate_manual_attestation', // training program is documentation
  'AT.L2-3.2.2': 'evaluate_manual_attestation',
  'AT.L2-3.2.3': 'evaluate_proxy_signal', // risky-user monitoring is a real signal

  // ── Audit & Accountability ─────────────────────────────────────
  'AU.L2-3.3.3': 'evaluate_proxy_signal', // "reviewed regularly" is a process
  'AU.L2-3.3.4': 'evaluate_proxy_signal', // alert-on-audit-failure config not readable
  'AU.L2-3.3.5': 'evaluate_security_monitoring', // correlation genuinely verifiable
  'AU.L2-3.3.6': 'evaluate_proxy_signal',
  'AU.L2-3.3.7': 'evaluate_platform_inherited', // M365 audit timestamps are Microsoft-generated UTC

  // ── Identification & Authentication ────────────────────────────
  'IA.L2-3.5.1': 'evaluate_platform_inherited', // Entra ID enforces unique UPN/objectId
  'IA.L2-3.5.4': 'evaluate_ca_auth_strength',
  'IA.L2-3.5.5': 'evaluate_proxy_signal', // stale-account review is a process
  'IA.L2-3.5.6': 'evaluate_proxy_signal',
  'IA.L2-3.5.7': 'evaluate_proxy_signal', // password protection settings not in queried payloads
  'IA.L2-3.5.8': 'evaluate_proxy_signal',
  'IA.L2-3.5.9': 'evaluate_proxy_signal',
  'IA.L2-3.5.10': 'evaluate_ca_legacy_auth_block',
  'IA.L2-3.5.11': 'evaluate_platform_inherited', // Entra sign-in errors are generic by design

  // ── Incident Response ──────────────────────────────────────────
  'IR.L2-3.6.1': 'evaluate_proxy_signal',
  'IR.L2-3.6.2': 'evaluate_proxy_signal',
  'IR.L2-3.6.3': 'evaluate_manual_attestation', // tabletop exercise is documentation

  // ── Maintenance ────────────────────────────────────────────────
  'MA.L2-3.7.1': 'evaluate_device_os_updates',
  'MA.L2-3.7.3': 'evaluate_proxy_signal', // remote wipe capability not directly readable
  'MA.L2-3.7.4': 'evaluate_proxy_signal',
  'MA.L2-3.7.5': 'evaluate_ca_auth_strength',

  // ── Media Protection ───────────────────────────────────────────
  'MP.L2-3.8.1': 'evaluate_device_encryption',
  'MP.L2-3.8.3': 'evaluate_proxy_signal',
  'MP.L2-3.8.5': 'evaluate_manual_attestation', // chain of custody is physical process
  'MP.L2-3.8.6': 'evaluate_proxy_signal',
  'MP.L2-3.8.7': 'evaluate_proxy_signal',
  'MP.L2-3.8.8': 'evaluate_proxy_signal',
  'MP.L2-3.8.9': 'evaluate_proxy_signal', // backup encryption outside Graph scope

  // ── Personnel Security ─────────────────────────────────────────
  'PS.L2-3.9.1': 'evaluate_manual_attestation', // background checks
  'PS.L2-3.9.2': 'evaluate_proxy_signal', // offboarding logs are a signal, process is manual

  // ── Physical Protection (facility controls — Graph cannot see them) ──
  'PE.L2-3.10.1': 'evaluate_proxy_signal',
  'PE.L2-3.10.2': 'evaluate_manual_attestation',
  'PE.L2-3.10.3': 'evaluate_manual_attestation',
  'PE.L2-3.10.4': 'evaluate_manual_attestation',
  'PE.L2-3.10.5': 'evaluate_proxy_signal',

  // ── Risk Assessment ────────────────────────────────────────────
  'RA.L2-3.11.1': 'evaluate_proxy_signal',
  'RA.L2-3.11.2': 'evaluate_proxy_signal',
  'RA.L2-3.11.3': 'evaluate_proxy_signal',

  // ── Security Assessment ────────────────────────────────────────
  'CA.L2-3.12.1': 'evaluate_manual_attestation', // assessment reports
  'CA.L2-3.12.2': 'evaluate_manual_attestation', // POA&M document
  'CA.L2-3.12.3': 'evaluate_proxy_signal',
  'CA.L2-3.12.4': 'evaluate_manual_attestation', // SSP document

  // ── System & Communications Protection ─────────────────────────
  'SC.L2-3.13.1': 'evaluate_proxy_signal',
  'SC.L2-3.13.2': 'evaluate_proxy_signal', // architecture documentation
  'SC.L2-3.13.5': 'evaluate_proxy_signal', // network segmentation outside Graph
  'SC.L2-3.13.6': 'evaluate_proxy_signal',
  'SC.L2-3.13.7': 'evaluate_proxy_signal', // VPN split-tunnel config in varied schemas
  'SC.L2-3.13.8': 'evaluate_platform_inherited', // M365 enforces TLS 1.2+ service-wide
  'SC.L2-3.13.9': 'evaluate_ca_session_controls',
  'SC.L2-3.13.10': 'evaluate_manual_attestation', // Key Vault outside Graph scope
  'SC.L2-3.13.11': 'evaluate_proxy_signal', // FIPS mode profile not generically readable
  'SC.L2-3.13.12': 'evaluate_proxy_signal',
  'SC.L2-3.13.13': 'evaluate_proxy_signal',
  'SC.L2-3.13.14': 'evaluate_proxy_signal',
  'SC.L2-3.13.15': 'evaluate_proxy_signal',
  'SC.L2-3.13.16': 'evaluate_device_encryption',

  // ── System & Information Integrity ─────────────────────────────
  'SI.L2-3.14.1': 'evaluate_device_os_updates',
  'SI.L2-3.14.2': 'evaluate_device_av',
  'SI.L2-3.14.3': 'evaluate_proxy_signal',
  'SI.L2-3.14.4': 'evaluate_device_av',
  'SI.L2-3.14.5': 'evaluate_proxy_signal',
  'SI.L2-3.14.6': 'evaluate_security_monitoring',
  'SI.L2-3.14.7': 'evaluate_security_monitoring',
}

let src = readFileSync(FILE, 'utf8')
let changed = 0

for (const [cid, evalName] of Object.entries(MAP)) {
  const idIdx = src.indexOf(`controlId: "${cid}"`)
  if (idIdx === -1) throw new Error(`controlId not found: ${cid}`)

  const marker = 'customEvaluator: "'
  const evalIdx = src.indexOf(marker, idIdx)
  if (evalIdx === -1) throw new Error(`customEvaluator not found after ${cid}`)

  // Safety: the evaluator we found must belong to THIS control's block
  const nextIdIdx = src.indexOf('controlId: "', idIdx + 1)
  if (nextIdIdx !== -1 && evalIdx > nextIdIdx) {
    throw new Error(`customEvaluator for ${cid} crosses into the next control block`)
  }

  const valueStart = evalIdx + marker.length
  const valueEnd = src.indexOf('"', valueStart)
  const oldName = src.slice(valueStart, valueEnd)
  if (oldName !== evalName) {
    src = src.slice(0, valueStart) + evalName + src.slice(valueEnd)
    changed++
    console.log(`${cid}: ${oldName} → ${evalName}`)
  }
}

// Smart Lockout is a platform behavior — make the passingCondition state the
// actual basis of the pass rather than implying tenant CA config does it.
src = src.replace(
  'Identity Protection or CA policies block/lock accounts after repeated failed sign-ins',
  'Entra ID Smart Lockout (always-on platform control) locks accounts after repeated failed sign-in attempts'
)

writeFileSync(FILE, src)
console.log(`\n${changed} control(s) remapped.`)
