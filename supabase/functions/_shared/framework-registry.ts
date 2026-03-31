// Framework Registry for Edge Functions
// Loads control definitions from bundled data files.
//
// DEPLOYMENT NOTE: Before deploying, copy the control data files from src/data/:
//   cp src/data/cmmc-l2-controls.ts    supabase/functions/_shared/controls/cmmc-l2-controls.ts
//   cp src/data/nist-csf-controls.ts   supabase/functions/_shared/controls/nist-csf-controls.ts
//   cp src/data/nist-800-171-controls.ts supabase/functions/_shared/controls/nist-800-171-controls.ts
//   cp src/data/hipaa-controls.ts       supabase/functions/_shared/controls/hipaa-controls.ts
//   cp src/data/finra-controls.ts       supabase/functions/_shared/controls/finra-controls.ts
//   cp src/data/ferpa-controls.ts       supabase/functions/_shared/controls/ferpa-controls.ts
//
// Then update imports in those files:
//   - Change `from "../types.js"` to `from "../types.ts"`
//   - Remove any .js extensions from imports

import type { ComplianceControl, FrameworkId, FrameworkDefinition } from './types.ts'

// Dynamic imports — will be available after control files are copied
const frameworkRegistry = new Map<string, FrameworkDefinition>()
let loaded = false

async function loadFrameworks() {
  if (loaded) return
  loaded = true

  try {
    const { cmmcL2Controls } = await import('./controls/cmmc-l2-controls.ts')
    frameworkRegistry.set('CMMC_L2', {
      id: 'CMMC_L2' as FrameworkId,
      name: 'CMMC Level 2',
      version: '2.0',
      description: 'Cybersecurity Maturity Model Certification Level 2',
      controls: cmmcL2Controls,
    })
  } catch { /* controls not yet bundled */ }

  try {
    const { nistCsfControls } = await import('./controls/nist-csf-controls.ts')
    frameworkRegistry.set('NIST_CSF', {
      id: 'NIST_CSF' as FrameworkId,
      name: 'NIST Cybersecurity Framework',
      version: '2.0',
      description: 'NIST CSF 2.0',
      controls: nistCsfControls,
    })
  } catch { /* controls not yet bundled */ }

  try {
    const { nist800171Controls } = await import('./controls/nist-800-171-controls.ts')
    frameworkRegistry.set('NIST_800_171', {
      id: 'NIST_800_171' as FrameworkId,
      name: 'NIST SP 800-171',
      version: 'r2',
      description: 'Protecting Controlled Unclassified Information',
      controls: nist800171Controls,
    })
  } catch { /* controls not yet bundled */ }

  try {
    const { hipaaControls } = await import('./controls/hipaa-controls.ts')
    frameworkRegistry.set('HIPAA', {
      id: 'HIPAA' as FrameworkId,
      name: 'HIPAA Security Rule',
      version: '2024',
      description: 'HIPAA Security Rule',
      controls: hipaaControls,
    })
  } catch { /* controls not yet bundled */ }

  try {
    const { finraControls } = await import('./controls/finra-controls.ts')
    frameworkRegistry.set('FINRA', {
      id: 'FINRA' as FrameworkId,
      name: 'FINRA Cybersecurity',
      version: '2024',
      description: 'FINRA Cybersecurity',
      controls: finraControls,
    })
  } catch { /* controls not yet bundled */ }

  try {
    const { ferpaControls } = await import('./controls/ferpa-controls.ts')
    frameworkRegistry.set('FERPA', {
      id: 'FERPA' as FrameworkId,
      name: 'FERPA',
      version: '2024',
      description: 'Family Educational Rights and Privacy Act',
      controls: ferpaControls,
    })
  } catch { /* controls not yet bundled */ }
}

export async function getFramework(id: string): Promise<FrameworkDefinition | undefined> {
  await loadFrameworks()
  return frameworkRegistry.get(id)
}

export async function listFrameworks(): Promise<FrameworkDefinition[]> {
  await loadFrameworks()
  return Array.from(frameworkRegistry.values())
}

export async function getFrameworkControls(id: string): Promise<ComplianceControl[]> {
  await loadFrameworks()
  return frameworkRegistry.get(id)?.controls ?? []
}
