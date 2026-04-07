// =============================================================================
// Framework Catalog — Single Source of Truth
//
// All framework metadata lives here. Imported by:
//   - web/app/api/list-frameworks/route.ts (API response)
//   - web/lib/api.ts (fallback)
//   - web/app/(app)/dashboard/page.tsx (pills)
//   - web/app/(app)/assess/page.tsx (cards)
// =============================================================================

import type { FrameworkMeta } from './types'

export type FrameworkCategory =
  | 'defense_gov'
  | 'financial'
  | 'healthcare'
  | 'privacy'
  | 'general_security'

export interface CatalogEntry extends FrameworkMeta {
  category: FrameworkCategory
  categoryLabel: string
}

export const FRAMEWORK_CATALOG: CatalogEntry[] = [
  // ── Defense & Government ──────────────────────────────────────────────────
  {
    id: 'cmmc-l2',
    name: 'CMMC Level 2',
    version: '2.0',
    description: 'Cybersecurity Maturity Model Certification Level 2',
    controlCount: 110,
    implemented: true,
    category: 'defense_gov',
    categoryLabel: 'Defense & Government',
  },
  {
    id: 'nist-800-171',
    name: 'NIST SP 800-171',
    version: 'Rev 2',
    description: 'Protecting Controlled Unclassified Information',
    controlCount: 110,
    implemented: true,
    category: 'defense_gov',
    categoryLabel: 'Defense & Government',
  },
  {
    id: 'nist-csf',
    name: 'NIST Cybersecurity Framework',
    version: '2.0',
    description: 'Identify, Protect, Detect, Respond, Recover functions',
    controlCount: 46,
    implemented: true,
    category: 'defense_gov',
    categoryLabel: 'Defense & Government',
  },

  // ── Financial Services ────────────────────────────────────────────────────
  {
    id: 'finra',
    name: 'FINRA Cybersecurity',
    version: '2024',
    description: 'Financial Industry Regulatory Authority',
    controlCount: 16,
    implemented: true,
    category: 'financial',
    categoryLabel: 'Financial Services',
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    version: '2017',
    description: 'AICPA Trust Services Criteria',
    controlCount: 60,
    implemented: false,
    category: 'financial',
    categoryLabel: 'Financial Services',
  },
  {
    id: 'pci-dss',
    name: 'PCI DSS',
    version: '4.0.1',
    description: 'Payment Card Industry Data Security Standard',
    controlCount: 78,
    implemented: false,
    category: 'financial',
    categoryLabel: 'Financial Services',
  },
  {
    id: 'sec',
    name: 'SEC Cybersecurity',
    version: '2023',
    description: 'SEC Risk Management and Incident Disclosure',
    controlCount: 20,
    implemented: false,
    category: 'financial',
    categoryLabel: 'Financial Services',
  },
  {
    id: 'nydfs-nycrr-500',
    name: 'NYDFS 23 NYCRR 500',
    version: '2023',
    description: 'NY Dept of Financial Services Cybersecurity Regulation',
    controlCount: 23,
    implemented: false,
    category: 'financial',
    categoryLabel: 'Financial Services',
  },

  // ── Healthcare & Life Sciences ────────────────────────────────────────────
  {
    id: 'hipaa',
    name: 'HIPAA Security Rule',
    version: '2024',
    description: 'Health Insurance Portability and Accountability Act',
    controlCount: 21,
    implemented: true,
    category: 'healthcare',
    categoryLabel: 'Healthcare & Life Sciences',
  },
  {
    id: 'hitrust',
    name: 'HITRUST CSF',
    version: '11.x',
    description: 'Health Information Trust Alliance Common Security Framework',
    controlCount: 75,
    implemented: false,
    category: 'healthcare',
    categoryLabel: 'Healthcare & Life Sciences',
  },
  {
    id: 'fda',
    name: 'FDA 21 CFR Part 11',
    version: '2024',
    description: 'Electronic records and electronic signatures',
    controlCount: 25,
    implemented: false,
    category: 'healthcare',
    categoryLabel: 'Healthcare & Life Sciences',
  },

  // ── Privacy & Education ───────────────────────────────────────────────────
  {
    id: 'ferpa',
    name: 'FERPA',
    version: '2024',
    description: 'Family Educational Rights and Privacy Act',
    controlCount: 13,
    implemented: true,
    category: 'privacy',
    categoryLabel: 'Privacy & Education',
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    version: '2016/679',
    description: 'General Data Protection Regulation (EU)',
    controlCount: 40,
    implemented: false,
    category: 'privacy',
    categoryLabel: 'Privacy & Education',
  },

  // ── General Security ──────────────────────────────────────────────────────
  {
    id: 'iso-27001',
    name: 'ISO 27001:2022',
    version: '2022',
    description: 'Information Security Management Systems',
    controlCount: 93,
    implemented: false,
    category: 'general_security',
    categoryLabel: 'General Security',
  },
  {
    id: 'iso-27017',
    name: 'ISO 27017',
    version: '2015',
    description: 'Cloud Security Controls based on ISO 27002',
    controlCount: 37,
    implemented: false,
    category: 'general_security',
    categoryLabel: 'General Security',
  },
  {
    id: 'cis-controls',
    name: 'CIS Controls',
    version: '8.0',
    description: 'Center for Internet Security Critical Security Controls',
    controlCount: 153,
    implemented: false,
    category: 'general_security',
    categoryLabel: 'General Security',
  },
  {
    id: 'mvsp',
    name: 'MVSP',
    version: '2024',
    description: 'Minimum Viable Secure Product baseline checklist',
    controlCount: 25,
    implemented: false,
    category: 'general_security',
    categoryLabel: 'General Security',
  },
]

/** Unique category labels in display order */
export const CATEGORY_ORDER: FrameworkCategory[] = [
  'defense_gov',
  'financial',
  'healthcare',
  'privacy',
  'general_security',
]

/** Get frameworks grouped by category */
export function getFrameworksByCategory(): Map<string, CatalogEntry[]> {
  const map = new Map<string, CatalogEntry[]>()
  for (const cat of CATEGORY_ORDER) {
    const entries = FRAMEWORK_CATALOG.filter(f => f.category === cat)
    if (entries.length > 0) {
      map.set(entries[0].categoryLabel, entries)
    }
  }
  return map
}
