// =============================================================================
// INDEX DSaaS - Framework Registry
// Central registry for all compliance frameworks and their control mappings
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";
import { baselineControls } from "./baseline-controls.js";
import { cmmcL2Controls } from "./cmmc-l2-controls.js";
import { nistCsfControls } from "./nist-csf-controls.js";
import { nist800171Controls } from "./nist-800-171-controls.js";
import { hipaaControls } from "./hipaa-controls.js";
import { finraControls } from "./finra-controls.js";
import { ferpaControls } from "./ferpa-controls.js";
import { soc2Controls } from "./soc2-controls.js";
import { iso27001Controls } from "./iso-27001-controls.js";
import { pciDssControls } from "./pci-dss-controls.js";
import { gdprControls } from "./gdpr-controls.js";
import { hitrustControls } from "./hitrust-controls.js";
import { fdaControls } from "./fda-controls.js";
import { nydfsNycrr500Controls } from "./nydfs-nycrr-500-controls.js";
import { secControls } from "./sec-controls.js";
import { iso27017Controls } from "./iso-27017-controls.js";
import { cisControls } from "./cis-controls-controls.js";
import { mvspControls } from "./mvsp-controls.js";
import { aiReadinessControls } from "./ai-readiness-controls.js";

interface FrameworkDefinition {
  id: FrameworkId;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
}

const frameworkRegistry: Map<FrameworkId, FrameworkDefinition> = new Map();

// Register Baseline
frameworkRegistry.set("BASELINE", {
  id: "BASELINE",
  name: "Current State Baseline",
  version: "1.0",
  description: "Current state baseline assessment across identity, devices, data protection, and audit/monitoring",
  controls: baselineControls,
});

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
// Coming Soon — stub registrations (empty control arrays)
// Controls will be populated as mappings are built
// ---------------------------------------------------------------------------

frameworkRegistry.set("SOC2", {
  id: "SOC2",
  name: "SOC 2 Type II",
  version: "2017",
  description: "AICPA Trust Services Criteria — Security, Availability, Processing Integrity, Confidentiality, and Privacy",
  controls: soc2Controls,
});

frameworkRegistry.set("ISO_27001", {
  id: "ISO_27001",
  name: "ISO 27001:2022",
  version: "2022",
  description: "Information security management systems — 93 controls across Organizational, People, Physical, and Technological themes",
  controls: iso27001Controls,
});

frameworkRegistry.set("PCI_DSS", {
  id: "PCI_DSS",
  name: "PCI DSS",
  version: "4.0.1",
  description: "Payment Card Industry Data Security Standard — 12 principal requirements for protecting cardholder data",
  controls: pciDssControls,
});

frameworkRegistry.set("GDPR", {
  id: "GDPR",
  name: "GDPR",
  version: "2016/679",
  description: "General Data Protection Regulation — data protection principles, data subject rights, and controller/processor obligations",
  controls: gdprControls,
});

frameworkRegistry.set("HITRUST", {
  id: "HITRUST",
  name: "HITRUST CSF",
  version: "11.x",
  description: "Health Information Trust Alliance Common Security Framework — risk-based approach integrating HIPAA, NIST, ISO, and PCI",
  controls: hitrustControls,
});

frameworkRegistry.set("FDA", {
  id: "FDA",
  name: "FDA 21 CFR Part 11",
  version: "2024",
  description: "Electronic records and electronic signatures — validation, audit trails, system access controls, and authority checks",
  controls: fdaControls,
});

frameworkRegistry.set("NYDFS_NYCRR_500", {
  id: "NYDFS_NYCRR_500",
  name: "NYDFS 23 NYCRR 500",
  version: "2023",
  description: "New York Department of Financial Services Cybersecurity Regulation — CISO, penetration testing, encryption, incident response",
  controls: nydfsNycrr500Controls,
});

frameworkRegistry.set("SEC", {
  id: "SEC",
  name: "SEC Cybersecurity",
  version: "2023",
  description: "SEC Cybersecurity Risk Management, Strategy, Governance, and Incident Disclosure rules",
  controls: secControls,
});

frameworkRegistry.set("ISO_27017", {
  id: "ISO_27017",
  name: "ISO 27017",
  version: "2015",
  description: "Code of practice for information security controls for cloud services based on ISO/IEC 27002",
  controls: iso27017Controls,
});

frameworkRegistry.set("CIS_CONTROLS", {
  id: "CIS_CONTROLS",
  name: "CIS Controls",
  version: "8.0",
  description: "Center for Internet Security Critical Security Controls — 18 top-level controls with 153 safeguards",
  controls: cisControls,
});

frameworkRegistry.set("MVSP", {
  id: "MVSP",
  name: "MVSP",
  version: "2024",
  description: "Minimum Viable Secure Product — baseline security checklist for enterprise-ready software vendors",
  controls: mvspControls,
});

frameworkRegistry.set("AI_READINESS", {
  id: "AI_READINESS",
  name: "AI Readiness Assessment",
  version: "1.0",
  description: "Evaluates data governance, identity, security, and compliance readiness for AI adoption (Copilot, third-party AI tools)",
  controls: aiReadinessControls,
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
