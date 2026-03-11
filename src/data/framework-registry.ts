// =============================================================================
// INDEX DSaaS - Framework Registry
// Central registry for all compliance frameworks and their control mappings
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";
import { cmmcL2Controls } from "./cmmc-l2-controls.js";
import { nistCsfControls } from "./nist-csf-controls.js";
import { nist800171Controls } from "./nist-800-171-controls.js";
import { hipaaControls } from "./hipaa-controls.js";
import { finraControls } from "./finra-controls.js";
import { ferpaControls } from "./ferpa-controls.js";

interface FrameworkDefinition {
  id: FrameworkId;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
}

const frameworkRegistry: Map<FrameworkId, FrameworkDefinition> = new Map();

// Register CMMC L2
frameworkRegistry.set("CMMC_L2", {
  id: "CMMC_L2",
  name: "CMMC Level 2",
  version: "2.0",
  description: "Cybersecurity Maturity Model Certification Level 2 - Advanced (110 practices based on NIST SP 800-171)",
  controls: cmmcL2Controls,
});

// Register NIST CSF 2.0
frameworkRegistry.set("NIST_CSF", {
  id: "NIST_CSF",
  name: "NIST Cybersecurity Framework",
  version: "2.0",
  description: "NIST CSF 2.0 — GV/ID/PR/DE/RS functions mapped to Microsoft 365 and Azure AD controls",
  controls: nistCsfControls,
});

// ---------------------------------------------------------------------------
// Stub registrations for future frameworks
// Add controls arrays as they're built out
// ---------------------------------------------------------------------------

frameworkRegistry.set("NIST_800_171", {
  id: "NIST_800_171",
  name: "NIST SP 800-171",
  version: "r2",
  description: "Protecting Controlled Unclassified Information in Nonfederal Systems — 110 requirements across 14 families (derived from CMMC L2 evidence mappings)",
  controls: nist800171Controls,
});

frameworkRegistry.set("HIPAA", {
  id: "HIPAA",
  name: "HIPAA Security Rule",
  version: "2024",
  description: "Health Insurance Portability and Accountability Act Security Rule (45 CFR Part 164) — 21 controls across Administrative, Physical, and Technical Safeguards mapped to Microsoft 365 and Azure AD",
  controls: hipaaControls,
});

frameworkRegistry.set("FINRA", {
  id: "FINRA",
  name: "FINRA Cybersecurity",
  version: "2024",
  description: "FINRA Cybersecurity Program requirements for broker-dealers — 16 controls across Governance, Access Controls, Data Protection, Vendor Management, Monitoring, and Business Continuity",
  controls: finraControls,
});

frameworkRegistry.set("FERPA", {
  id: "FERPA",
  name: "FERPA",
  version: "2024",
  description: "Family Educational Rights and Privacy Act — 13 controls protecting student education records across Identity Management, Data Protection, Audit, Third-Party, and Incident Response domains",
  controls: ferpaControls,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getFramework(id: FrameworkId): FrameworkDefinition | undefined {
  return frameworkRegistry.get(id);
}

export function listFrameworks(): FrameworkDefinition[] {
  return Array.from(frameworkRegistry.values());
}

export function getFrameworkControls(id: FrameworkId): ComplianceControl[] {
  return frameworkRegistry.get(id)?.controls ?? [];
}

export function getAvailableFrameworkIds(): FrameworkId[] {
  return Array.from(frameworkRegistry.keys());
}

export function getImplementedFrameworks(): FrameworkDefinition[] {
  return Array.from(frameworkRegistry.values()).filter((f) => f.controls.length > 0);
}
