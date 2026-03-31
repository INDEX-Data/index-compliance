// =============================================================================
// INDEX DSaaS — NIST SP 800-171 Rev 2 Controls
//
// NIST SP 800-171 r2 and CMMC Level 2 are a 1-to-1 mapping of the same
// 110 requirements across 14 families. Rather than duplicating all evidence
// queries and evaluators, we derive from the CMMC L2 controls by:
//   - Re-labelling frameworkId  →  "NIST_800_171"
//   - Mapping control IDs:      "AC.L2-3.1.1"  →  "3.1.1"
//   - Using NIST family names:  "Access Control" instead of CMMC domain
//
// All Graph API evidence queries and evaluation logic are inherited unchanged.
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.ts";
import { cmmcL2Controls } from "./cmmc-l2-controls.ts";

const FW: FrameworkId = "NIST_800_171";

// NIST SP 800-171 r2 — 14 security requirement families
// Referenced by the first part of the CMMC domain code (AC, AT, AU, …)
const FAMILY_MAP: Record<string, string> = {
  AC: "Access Control (3.1)",
  AT: "Awareness and Training (3.2)",
  AU: "Audit and Accountability (3.3)",
  CM: "Configuration Management (3.4)",
  IA: "Identification and Authentication (3.5)",
  IR: "Incident Response (3.6)",
  MA: "Maintenance (3.7)",
  MP: "Media Protection (3.8)",
  PS: "Personnel Security (3.9)",
  PE: "Physical Protection (3.10)",
  RA: "Risk Assessment (3.11)",
  CA: "Security Assessment (3.12)",
  SC: "System and Communications Protection (3.13)",
  SI: "System and Information Integrity (3.14)",
};

/**
 * Extract the NIST requirement number from a CMMC control ID.
 *   "AC.L2-3.1.1"  →  "3.1.1"
 *   "SI.L2-3.14.6" →  "3.14.6"
 */
function nistId(cmmcControlId: string): string {
  // Format: <DOMAIN>.L2-<NUMBER>
  const dashIdx = cmmcControlId.indexOf("-");
  return dashIdx !== -1 ? cmmcControlId.slice(dashIdx + 1) : cmmcControlId;
}

/**
 * Extract the NIST family name from a CMMC control ID.
 *   "AC.L2-3.1.1"  →  "Access Control (3.1)"
 */
function nistFamily(cmmcControlId: string): string {
  const domain = cmmcControlId.split(".")[0];
  return FAMILY_MAP[domain] ?? "Other";
}

// Build the NIST 800-171 r2 controls array by remapping each CMMC control
export const nist800171Controls: ComplianceControl[] = cmmcL2Controls.map(
  (ctrl): ComplianceControl => ({
    ...ctrl,
    controlId:   nistId(ctrl.controlId),
    frameworkId: FW,
    family:      nistFamily(ctrl.controlId),
  })
);
