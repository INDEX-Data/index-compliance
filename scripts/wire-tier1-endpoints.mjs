// Tier 1 wiring: add the deep-inspection endpoint to each target control and
// point it at the matching deep evaluator. Idempotent — skips a control whose
// endpoint is already present. Run: node scripts/wire-tier1-endpoints.mjs
import { readFileSync, writeFileSync } from 'fs'

const FILE = new URL('../src/data/cmmc-l2-controls.ts', import.meta.url)
let src = readFileSync(FILE, 'utf8')

// id-prefix is derived per control to keep evidence-query ids unique.
function idPrefix(cid) {
  return cid.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.')
}

const deviceConfigQuery = (cid) => `      {
        id: '${idPrefix(cid)}-device-config-profiles',
        description: 'Intune device configuration profiles (USB/removable storage, VPN, peripherals)',
        endpoint: '/deviceManagement/deviceConfigurations',
        method: 'GET',
        category: 'deviceConfiguration',
        requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
      },
`

const sharepointQuery = (cid) => `      {
        id: '${idPrefix(cid)}-spo-settings',
        description: 'SharePoint/OneDrive tenant external sharing settings',
        endpoint: '/admin/sharepoint/settings',
        method: 'GET',
        category: 'sharePoint',
        requiredPermissions: ['SharePointTenantSettings.Read.All'],
      },
`

// control → { evaluator, inject?(query factory), endpointMarker }
const PLAN = {
  'AC.L2-3.1.21': { evaluator: 'evaluate_device_usb_control', inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'MP.L2-3.8.6':  { evaluator: 'evaluate_device_usb_control', inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'MP.L2-3.8.7':  { evaluator: 'evaluate_device_usb_control', inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'MP.L2-3.8.8':  { evaluator: 'evaluate_device_usb_control', inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'SC.L2-3.13.7': { evaluator: 'evaluate_device_vpn_tunnel',  inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'SC.L2-3.13.12':{ evaluator: 'evaluate_device_peripheral',  inject: deviceConfigQuery, marker: '/deviceManagement/deviceConfigurations' },
  'IA.L2-3.5.9':  { evaluator: 'evaluate_tap_policy' }, // already queries authenticationMethodsPolicy
  'AC.L2-3.1.22': { evaluator: 'evaluate_sharepoint_sharing', inject: sharepointQuery, marker: '/admin/sharepoint/settings' },
}

let injected = 0
let remapped = 0

for (const [cid, plan] of Object.entries(PLAN)) {
  const idIdx = src.indexOf(`controlId: '${cid}'`)
  if (idIdx === -1) throw new Error(`controlId not found: ${cid}`)
  const nextIdIdx = src.indexOf('controlId: ', idIdx + 1)
  const blockEnd = nextIdIdx === -1 ? src.length : nextIdIdx

  // 1. Inject the new evidence query right after this control's `evidenceQueries: [`
  if (plan.inject && !src.slice(idIdx, blockEnd).includes(plan.marker)) {
    const arrTokenIdx = src.indexOf('evidenceQueries: [', idIdx)
    if (arrTokenIdx === -1 || arrTokenIdx > blockEnd) throw new Error(`evidenceQueries not found for ${cid}`)
    const insertAt = arrTokenIdx + 'evidenceQueries: ['.length + 1 // just after the newline following '['
    src = src.slice(0, insertAt) + plan.inject(cid) + src.slice(insertAt)
    injected++
    console.log(`${cid}: injected ${plan.marker}`)
  }

  // 2. Repoint the evaluator (re-locate after possible injection shifted offsets)
  const idIdx2 = src.indexOf(`controlId: '${cid}'`)
  const marker = 'customEvaluator: '
  const evalIdx = src.indexOf(marker, idIdx2)
  const valStart = src.indexOf("'", evalIdx) + 1
  const valEnd = src.indexOf("'", valStart)
  const old = src.slice(valStart, valEnd)
  if (old !== plan.evaluator) {
    src = src.slice(0, valStart) + plan.evaluator + src.slice(valEnd)
    remapped++
    console.log(`${cid}: ${old} → ${plan.evaluator}`)
  }
}

writeFileSync(FILE, src)
console.log(`\n${injected} endpoint(s) injected, ${remapped} evaluator(s) remapped.`)
