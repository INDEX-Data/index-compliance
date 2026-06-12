// One-time remap for the six NIST CSF controls still on evaluate_evidence_exists.
// Run: node scripts/remap-nist-csf-evaluators.mjs
import { readFileSync, writeFileSync } from 'fs'

const FILE = new URL('../src/data/nist-csf-controls.ts', import.meta.url)

const MAP = {
  'GV.OC-01': 'evaluate_org_security_contacts', // reads actual contact fields
  'GV.RM-01': 'evaluate_risk_assessment', // reads actual Secure Score values
  'PR.AT-01': 'evaluate_proxy_signal', // training program is a documented process
  'RS.MA-02': 'evaluate_org_security_contacts',
  'RS.CO-01': 'evaluate_org_security_contacts',
  'RC.CO-03': 'evaluate_org_security_contacts',
}

let src = readFileSync(FILE, 'utf8')
let changed = 0

for (const [cid, evalName] of Object.entries(MAP)) {
  const idIdx = src.indexOf(`controlId: "${cid}"`)
  if (idIdx === -1) throw new Error(`controlId not found: ${cid}`)
  const marker = 'customEvaluator: "'
  const evalIdx = src.indexOf(marker, idIdx)
  const nextIdIdx = src.indexOf('controlId: "', idIdx + 1)
  if (evalIdx === -1 || (nextIdIdx !== -1 && evalIdx > nextIdIdx)) {
    throw new Error(`customEvaluator not found inside block for ${cid}`)
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

writeFileSync(FILE, src)
console.log(`\n${changed} control(s) remapped.`)
