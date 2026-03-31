// =============================================================================
// Edge Function: list-frameworks
// Returns available compliance frameworks and their metadata.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'

// Framework metadata — static data, no DB needed
const frameworks = [
  {
    id: 'CMMC_L2',
    name: 'CMMC Level 2',
    version: '2.0',
    description: 'Cybersecurity Maturity Model Certification Level 2 — 110 practices based on NIST SP 800-171',
    controlCount: 110,
    implemented: true,
  },
  {
    id: 'NIST_CSF',
    name: 'NIST Cybersecurity Framework',
    version: '2.0',
    description: 'NIST CSF 2.0 — GV/ID/PR/DE/RS functions mapped to Microsoft 365 and Azure AD controls',
    controlCount: 23,
    implemented: true,
  },
  {
    id: 'NIST_800_171',
    name: 'NIST SP 800-171',
    version: 'r2',
    description: 'Protecting Controlled Unclassified Information in Nonfederal Systems — 110 requirements across 14 families',
    controlCount: 110,
    implemented: true,
  },
  {
    id: 'HIPAA',
    name: 'HIPAA Security Rule',
    version: '2024',
    description: 'Health Insurance Portability and Accountability Act Security Rule — 21 controls',
    controlCount: 21,
    implemented: true,
  },
  {
    id: 'FINRA',
    name: 'FINRA Cybersecurity',
    version: '2024',
    description: 'FINRA Cybersecurity Program requirements for broker-dealers — 16 controls',
    controlCount: 16,
    implemented: true,
  },
  {
    id: 'FERPA',
    name: 'FERPA',
    version: '2024',
    description: 'Family Educational Rights and Privacy Act — 13 controls',
    controlCount: 13,
    implemented: true,
  },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  return new Response(JSON.stringify(frameworks), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
