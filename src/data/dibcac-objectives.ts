// =============================================================================
// INDEX DSaaS — DIBCAC 320 Assessment Objectives
// Source: NIST SP 800-171A / DIBCAC Assessment Objectives CSV
// Maps all 320 assessment objectives to CMMC L2 parent controls
// =============================================================================

export type ObjectiveStandard =
  | "Document"
  | "Screen Share"
  | "Artifact"
  | "Physical Review"
  | "Artifact and Screen Share";

/**
 * Automation level describes how INDEX can satisfy this objective:
 *  automated      — Graph API evidence definitively verifies it
 *  semi-automated — Graph API provides supporting evidence; human review confirms
 *  manual         — Requires attestation text or document upload
 *  physical       — Requires on-site DIBCAC physical inspection; cannot be automated
 */
export type ObjectiveAutomation = "automated" | "semi-automated" | "manual" | "physical";

export interface DIBCACObjective {
  /** e.g. "3.1.1[a]" */
  objectiveId: string;
  /** Base NIST requirement, e.g. "3.1.1" */
  requirementNumber: string;
  /** CMMC L2 control ID, e.g. "AC.L2-3.1.1" */
  controlId: string;
  /** NIST domain abbreviation, e.g. "AC" */
  domain: string;
  /** Full domain name, e.g. "Access Control" */
  domainName: string;
  /** Plain-text objective from the DIBCAC worksheet */
  text: string;
  /** DIBCAC evidence type */
  standard: ObjectiveStandard;
  /** INDEX automation level */
  automation: ObjectiveAutomation;
}

// ---------------------------------------------------------------------------
// Domain Lookup
// ---------------------------------------------------------------------------

const DOMAIN_ABBR: Record<string, string> = {
  "1":  "AC",
  "2":  "AT",
  "3":  "AU",
  "4":  "CM",
  "5":  "IA",
  "6":  "IR",
  "7":  "MA",
  "8":  "MP",
  "9":  "PS",
  "10": "PE",
  "11": "RA",
  "12": "CA",
  "13": "SC",
  "14": "SI",
};

const DOMAIN_NAMES: Record<string, string> = {
  AC: "Access Control",
  AT: "Awareness and Training",
  AU: "Audit and Accountability",
  CM: "Configuration Management",
  IA: "Identification and Authentication",
  IR: "Incident Response",
  MA: "Maintenance",
  MP: "Media Protection",
  PS: "Personnel Security",
  PE: "Physical and Environmental Protection",
  RA: "Risk Assessment",
  CA: "Security Assessment",
  SC: "System and Communications Protection",
  SI: "System and Information Integrity",
};

/** Domains where Graph API can directly verify Screen Share / Artifact objectives */
const AUTOMATED_DOMAINS = new Set(["AC", "AU", "IA", "SC", "SI", "RA", "CM"]);

function parseObjective(
  id: string,
  text: string,
  standard: ObjectiveStandard
): DIBCACObjective {
  // Extract base requirement: "3.1.1[a]" → "3.1.1"  |  "3.10.4" → "3.10.4"
  const reqMatch = id.match(/^(\d+\.\d+\.\d+)/);
  const requirementNumber = reqMatch ? reqMatch[1] : id;

  // Extract sub-domain index: "3.10.x" → "10"
  const subMatch = requirementNumber.match(/^3\.(\d+)\./);
  const subIndex  = subMatch ? subMatch[1] : "1";

  const domain     = DOMAIN_ABBR[subIndex] ?? "AC";
  const domainName = DOMAIN_NAMES[domain]  ?? domain;
  const controlId  = `${domain}.L2-${requirementNumber}`;

  let automation: ObjectiveAutomation;
  if (standard === "Physical Review") {
    automation = "physical";
  } else if (standard === "Document") {
    automation = "manual";
  } else if (AUTOMATED_DOMAINS.has(domain)) {
    automation = standard === "Artifact" ? "semi-automated" : "automated";
  } else {
    automation = "manual";
  }

  return { objectiveId: id, requirementNumber, controlId, domain, domainName, text, standard, automation };
}

// ---------------------------------------------------------------------------
// Raw objectives — [id, text, standard]
// ---------------------------------------------------------------------------

type RawRow = [string, string, ObjectiveStandard];

/* eslint-disable max-len */
const RAW: RawRow[] = [
  // ===== AC — Access Control (3.1.x) =====
  ["3.1.1[a]",  "authorized users are identified.", "Document"],
  ["3.1.1[b]",  "processes acting on behalf of authorized users are identified.", "Document"],
  ["3.1.1[c]",  "devices (and other systems) authorized to connect to the system are identified.", "Document"],
  ["3.1.1[d]",  "system access is limited to authorized users.", "Screen Share"],
  ["3.1.1[e]",  "system access is limited to processes acting on behalf of authorized users.", "Screen Share"],
  ["3.1.1[f]",  "system access is limited to authorized devices (including other systems).", "Screen Share"],

  ["3.1.2[a]",  "the types of transactions and functions that authorized users are permitted to execute are defined.", "Document"],
  ["3.1.2[b]",  "system access is limited to the defined types of transactions and functions for authorized users.", "Screen Share"],

  ["3.1.3[a]",  "information flow control policies are defined.", "Document"],
  ["3.1.3[b]",  "methods and enforcement mechanisms for controlling the flow of CUI are defined.", "Document"],
  ["3.1.3[c]",  "designated sources and destinations (e.g., networks, individuals, and devices) for CUI within the system and between interconnected systems are identified.", "Artifact"],
  ["3.1.3[d]",  "authorizations for controlling the flow of CUI are defined.", "Document"],
  ["3.1.3[e]",  "approved authorizations for controlling the flow of CUI are enforced.", "Screen Share"],

  ["3.1.4[a]",  "the duties of individuals requiring separation are defined.", "Document"],
  ["3.1.4[b]",  "responsibilities for duties that require separation are assigned to separate individuals.", "Screen Share"],
  ["3.1.4[c]",  "access privileges that enable individuals to exercise the duties that require separation are granted to separate individuals.", "Screen Share"],

  ["3.1.5[a]",  "privileged accounts are identified.", "Document"],
  ["3.1.5[b]",  "access to privileged accounts is authorized in accordance with the principle of least privilege.", "Artifact"],
  ["3.1.5[c]",  "security functions are identified.", "Document"],
  ["3.1.5[d]",  "access to security functions is authorized in accordance with the principle of least privilege.", "Artifact"],

  ["3.1.6[a]",  "nonsecurity functions are identified.", "Document"],
  ["3.1.6[b]",  "users are required to use non-privileged accounts or roles when accessing nonsecurity functions.", "Screen Share"],

  ["3.1.7[a]",  "privileged functions are defined.", "Document"],
  ["3.1.7[b]",  "non-privileged users are defined.", "Document"],
  ["3.1.7[c]",  "non-privileged users are prevented from executing privileged functions.", "Screen Share"],
  ["3.1.7[d]",  "the execution of privileged functions is captured in audit logs.", "Screen Share"],

  ["3.1.8[a]",  "the means of limiting unsuccessful logon attempts is defined.", "Document"],
  ["3.1.8[b]",  "the defined means of limiting unsuccessful logon attempts is implemented.", "Artifact"],

  ["3.1.9[a]",  "privacy and security notices required by CUI-specified rules are identified, consistent, and associated with the specific CUI category.", "Document"],
  ["3.1.9[b]",  "privacy and security notices are displayed.", "Artifact"],

  ["3.1.10[a]", "the period of inactivity after which the system initiates a session lock is defined.", "Document"],
  ["3.1.10[b]", "access to the system and viewing of data is prevented by initiating a session lock after the defined period of inactivity.", "Artifact"],
  ["3.1.10[c]", "previously visible information is concealed via a pattern-hiding display after the defined period of inactivity.", "Document"],

  ["3.1.11[a]", "conditions requiring a user session to terminate are defined.", "Document"],
  ["3.1.11[b]", "a user session is automatically terminated after any of the defined conditions occur.", "Screen Share"],

  ["3.1.12[a]", "remote access sessions are permitted.", "Document"],
  ["3.1.12[b]", "the types of permitted remote access are identified.", "Document"],
  ["3.1.12[c]", "remote access sessions are controlled.", "Screen Share"],
  ["3.1.12[d]", "remote access sessions are monitored.", "Screen Share"],

  ["3.1.13[a]", "cryptographic mechanisms to protect the confidentiality of remote access sessions are identified.", "Document"],
  ["3.1.13[b]", "cryptographic mechanisms to protect the confidentiality of remote access sessions are implemented.", "Screen Share"],

  ["3.1.14[a]", "managed access control points are identified and implemented.", "Screen Share"],
  ["3.1.14[b]", "remote access is routed through managed network access control points.", "Screen Share"],

  ["3.1.15[a]", "privileged commands authorized for remote execution are identified.", "Document"],
  ["3.1.15[b]", "security-relevant information authorized to be accessed remotely is identified.", "Document"],
  ["3.1.15[c]", "the execution of the identified privileged commands via remote access is authorized.", "Artifact"],
  ["3.1.15[d]", "access to the identified security-relevant information via remote access is authorized.", "Artifact"],

  ["3.1.16[a]", "wireless access points are identified.", "Document"],
  ["3.1.16[b]", "wireless access is authorized prior to allowing such connections.", "Screen Share"],

  ["3.1.17[a]", "wireless access to the system is protected using authentication.", "Screen Share"],
  ["3.1.17[b]", "wireless access to the system is protected using encryption.", "Screen Share"],

  ["3.1.18[a]", "mobile devices that process, store, or transmit CUI are identified.", "Document"],
  ["3.1.18[b]", "mobile device connections are authorized.", "Artifact"],
  ["3.1.18[c]", "mobile device connections are monitored and logged.", "Screen Share"],

  ["3.1.19[a]", "mobile devices and mobile computing platforms that process, store, or transmit CUI are identified.", "Document"],
  ["3.1.19[b]", "encryption is employed to protect CUI on identified mobile devices and mobile computing platforms.", "Screen Share"],

  ["3.1.20[a]", "connections to external systems are identified.", "Document"],
  ["3.1.20[b]", "the use of external systems is identified.", "Document"],
  ["3.1.20[c]", "connections to external systems are verified.", "Artifact"],
  ["3.1.20[d]", "the use of external systems is verified.", "Artifact"],
  ["3.1.20[e]", "connections to external systems are controlled/limited.", "Screen Share"],
  ["3.1.20[f]", "the use of external systems is controlled/limited.", "Screen Share"],

  ["3.1.21[a]", "the use of portable storage devices containing CUI on external systems is identified and documented.", "Document"],
  ["3.1.21[b]", "limits on the use of portable storage devices containing CUI on external systems are defined.", "Document"],
  ["3.1.21[c]", "the use of portable storage devices containing CUI on external systems is limited as defined.", "Document"],

  ["3.1.22[a]", "individuals authorized to post or process information on publicly accessible systems are identified.", "Document"],
  ["3.1.22[b]", "procedures to ensure CUI is not posted or processed on publicly accessible systems are identified.", "Document"],
  ["3.1.22[c]", "a review process is in place prior to posting of any content to publicly accessible systems.", "Artifact"],
  ["3.1.22[d]", "content on publicly accessible systems is reviewed to ensure that it does not include CUI.", "Artifact"],
  ["3.1.22[e]", "mechanisms are in place to remove and address improper posting of CUI.", "Artifact"],

  // ===== AT — Awareness and Training (3.2.x) =====
  ["3.2.1[a]",  "security risks associated with organizational activities involving CUI are identified.", "Document"],
  ["3.2.1[b]",  "policies, standards, and procedures related to the security of the system are identified.", "Document"],
  ["3.2.1[c]",  "managers, systems administrators, and users of the system are made aware of the security risks associated with their activities.", "Artifact"],
  ["3.2.1[d]",  "managers, systems administrators, and users of the system are made aware of the applicable policies, standards, and procedures related to the security of the system.", "Artifact"],

  ["3.2.2[a]",  "information security-related duties, roles, and responsibilities are defined.", "Document"],
  ["3.2.2[b]",  "information security-related duties, roles, and responsibilities are assigned to designated personnel.", "Artifact"],
  ["3.2.2[c]",  "personnel are adequately trained to carry out their assigned information security-related duties, roles, and responsibilities.", "Artifact"],

  ["3.2.3[a]",  "potential indicators associated with insider threats are identified.", "Document"],
  ["3.2.3[b]",  "security awareness training on recognizing and reporting potential indicators of insider threat is provided to managers and employees.", "Artifact"],

  // ===== AU — Audit and Accountability (3.3.x) =====
  ["3.3.1[a]",  "audit logs needed (i.e., event types to be logged) to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity are specified.", "Document"],
  ["3.3.1[b]",  "the content of audit records needed to support monitoring, analysis, investigation, and reporting of unlawful or unauthorized system activity is defined.", "Document"],
  ["3.3.1[c]",  "audit records are created (generated).", "Screen Share"],
  ["3.3.1[d]",  "audit records, once created, contain the defined content.", "Screen Share"],
  ["3.3.1[e]",  "retention requirements for audit records are defined.", "Document"],
  ["3.3.1[f]",  "audit records are retained as defined.", "Screen Share"],

  ["3.3.2[a]",  "the content of the audit records needed to support the ability to uniquely trace users to their actions is defined.", "Document"],
  ["3.3.2[b]",  "audit records, once created, contain the defined content.", "Screen Share"],

  ["3.3.3[a]",  "a process for determining when to review logged events is defined.", "Document"],
  ["3.3.3[b]",  "event types being logged are reviewed in accordance with the defined review process.", "Artifact"],
  ["3.3.3[c]",  "event types being logged are updated based on the review.", "Artifact"],

  ["3.3.4[a]",  "personnel or roles to be alerted in the event of an audit logging process failure are identified.", "Document"],
  ["3.3.4[b]",  "types of audit logging process failures for which alert will be generated are defined.", "Document"],
  ["3.3.4[c]",  "identified personnel or roles are alerted in the event of an audit logging process failure.", "Artifact"],

  ["3.3.5[a]",  "audit record review, analysis, and reporting processes for investigation and response to indications of unlawful, unauthorized, suspicious, or unusual activity are defined.", "Document"],
  ["3.3.5[b]",  "defined audit record review, analysis, and reporting processes are correlated.", "Artifact"],

  ["3.3.6[a]",  "an audit record reduction capability that supports on-demand analysis is provided.", "Screen Share"],
  ["3.3.6[b]",  "a report generation capability that supports on-demand reporting is provided.", "Screen Share"],

  ["3.3.7[a]",  "internal system clocks are used to generate time stamps for audit records.", "Screen Share"],
  ["3.3.7[b]",  "an authoritative source with which to compare and synchronize internal system clocks is specified.", "Document"],
  ["3.3.7[c]",  "internal system clocks used to generate time stamps for audit records are compared to and synchronized with the specified authoritative time source.", "Screen Share"],

  ["3.3.8[a]",  "audit information is protected from unauthorized access.", "Screen Share"],
  ["3.3.8[b]",  "audit information is protected from unauthorized modification.", "Screen Share"],
  ["3.3.8[c]",  "audit information is protected from unauthorized deletion.", "Screen Share"],
  ["3.3.8[d]",  "audit logging tools are protected from unauthorized access.", "Screen Share"],
  ["3.3.8[e]",  "audit logging tools are protected from unauthorized modification.", "Screen Share"],
  ["3.3.8[f]",  "audit logging tools are protected from unauthorized deletion.", "Screen Share"],

  ["3.3.9[a]",  "a subset of privileged users granted access to manage audit logging functionality is defined.", "Document"],
  ["3.3.9[b]",  "management of audit logging functionality is limited to the defined subset of privileged users.", "Screen Share"],

  // ===== CM — Configuration Management (3.4.x) =====
  ["3.4.1[a]",  "a baseline configuration is established.", "Document"],
  ["3.4.1[b]",  "the baseline configuration includes hardware, software, firmware, and documentation.", "Artifact"],
  ["3.4.1[c]",  "the baseline configuration is maintained (reviewed and updated) throughout the system development life cycle.", "Artifact"],
  ["3.4.1[d]",  "a system inventory is established.", "Document"],
  ["3.4.1[e]",  "the system inventory includes hardware, software, firmware, and documentation.", "Artifact"],
  ["3.4.1[f]",  "the inventory is maintained (reviewed and updated) throughout the system development life cycle.", "Artifact"],

  ["3.4.2[a]",  "security configuration settings for information technology products employed in the system are established and included in the baseline configuration.", "Document"],
  ["3.4.2[b]",  "security configuration settings for information technology products employed in the system are enforced.", "Artifact"],

  ["3.4.3[a]",  "changes to the system are tracked.", "Artifact"],
  ["3.4.3[b]",  "changes to the system are reviewed.", "Artifact"],
  ["3.4.3[c]",  "changes to the system are approved or disapproved.", "Artifact"],
  ["3.4.3[d]",  "changes to the system are logged.", "Artifact"],

  ["3.4.4",     "Determine if the security impact of changes to the system is analyzed prior to implementation.", "Artifact"],

  ["3.4.5[a]",  "physical access restrictions associated with changes to the system are defined.", "Document"],
  ["3.4.5[b]",  "physical access restrictions associated with changes to the system are documented.", "Document"],
  ["3.4.5[c]",  "physical access restrictions associated with changes to the system are approved.", "Artifact"],
  ["3.4.5[d]",  "physical access restrictions associated with changes to the system are enforced.", "Physical Review"],
  ["3.4.5[e]",  "logical access restrictions associated with changes to the system are defined.", "Document"],
  ["3.4.5[f]",  "logical access restrictions associated with changes to the system are documented.", "Document"],
  ["3.4.5[g]",  "logical access restrictions associated with changes to the system are approved.", "Artifact"],
  ["3.4.5[h]",  "logical access restrictions associated with changes to the system are enforced.", "Artifact"],

  ["3.4.6[a]",  "essential system capabilities are defined based on the principle of least functionality.", "Document"],
  ["3.4.6[b]",  "the system is configured to provide only the defined essential capabilities.", "Screen Share"],

  ["3.4.7[a]",  "essential programs are defined.", "Document"],
  ["3.4.7[b]",  "the use of nonessential programs is defined.", "Document"],
  ["3.4.7[c]",  "the use of nonessential programs is restricted, disabled, or prevented as defined.", "Screen Share"],
  ["3.4.7[d]",  "essential functions are defined.", "Document"],
  ["3.4.7[e]",  "the use of nonessential functions is defined.", "Document"],
  ["3.4.7[f]",  "the use of nonessential functions is restricted, disabled, or prevented as defined.", "Screen Share"],
  ["3.4.7[g]",  "essential ports are defined.", "Document"],
  ["3.4.7[h]",  "the use of nonessential ports is defined.", "Document"],
  ["3.4.7[i]",  "the use of nonessential ports is restricted, disabled, or prevented as defined.", "Screen Share"],
  ["3.4.7[j]",  "essential protocols are defined.", "Document"],
  ["3.4.7[k]",  "the use of nonessential protocols is defined.", "Document"],
  ["3.4.7[l]",  "the use of nonessential protocols is restricted, disabled, or prevented as defined.", "Screen Share"],
  ["3.4.7[m]",  "essential services are defined.", "Document"],
  ["3.4.7[n]",  "the use of nonessential services is defined.", "Document"],
  ["3.4.7[o]",  "the use of nonessential services is restricted, disabled, or prevented as defined.", "Screen Share"],

  ["3.4.8[a]",  "a policy specifying whether whitelisting or blacklisting is to be implemented is specified.", "Document"],
  ["3.4.8[b]",  "the software allowed to execute under whitelisting or denied use under blacklisting is specified.", "Document"],
  ["3.4.8[c]",  "whitelisting to allow the execution of authorized software or blacklisting to prevent the use of unauthorized software is implemented as specified.", "Screen Share"],

  ["3.4.9[a]",  "a policy for controlling the installation of software by users is established.", "Document"],
  ["3.4.9[b]",  "installation of software by users is controlled based on the established policy.", "Screen Share"],
  ["3.4.9[c]",  "installation of software by users is monitored.", "Screen Share"],

  // ===== IA — Identification and Authentication (3.5.x) =====
  ["3.5.1[a]",  "system users are identified.", "Document"],
  ["3.5.1[b]",  "processes acting on behalf of users are identified.", "Document"],
  ["3.5.1[c]",  "devices accessing the system are identified.", "Document"],

  ["3.5.2[a]",  "the identity of each user is authenticated or verified as a prerequisite to system access.", "Screen Share"],
  ["3.5.2[b]",  "the identity of each process acting on behalf of a user is authenticated or verified as a prerequisite to system access.", "Screen Share"],
  ["3.5.2[c]",  "the identity of each device accessing or connecting to the system is authenticated or verified as a prerequisite to system access.", "Screen Share"],

  ["3.5.3[a]",  "privileged accounts are identified.", "Document"],
  ["3.5.3[b]",  "multifactor authentication is implemented for local access to privileged accounts.", "Screen Share"],
  ["3.5.3[c]",  "multifactor authentication is implemented for network access to privileged accounts.", "Screen Share"],
  ["3.5.3[d]",  "multifactor authentication is implemented for network access to non-privileged accounts.", "Screen Share"],

  ["3.5.4",     "Determine if replay-resistant authentication mechanisms are implemented for network account access to privileged and non-privileged accounts.", "Screen Share"],

  ["3.5.5[a]",  "a period within which identifiers cannot be reused is defined.", "Document"],
  ["3.5.5[b]",  "reuse of identifiers is prevented within the defined period.", "Artifact"],

  ["3.5.6[a]",  "a period of inactivity after which an identifier is disabled is defined.", "Document"],
  ["3.5.6[b]",  "identifiers are disabled after the defined period of inactivity.", "Artifact"],

  ["3.5.7[a]",  "password complexity requirements are defined.", "Document"],
  ["3.5.7[b]",  "password change of character requirements are defined.", "Document"],
  ["3.5.7[c]",  "minimum password complexity requirements as defined are enforced when new passwords are created.", "Screen Share"],
  ["3.5.7[d]",  "minimum password change of character requirements as defined are enforced when new passwords are created.", "Screen Share"],

  ["3.5.8[a]",  "the number of generations during which a password cannot be reused is specified.", "Document"],
  ["3.5.8[b]",  "reuse of passwords is prohibited during the specified number of generations.", "Screen Share"],

  ["3.5.9",     "Determine if an immediate change to a permanent password is required when a temporary password is used for system logon.", "Document"],

  ["3.5.10[a]", "passwords are cryptographically protected in storage.", "Screen Share"],
  ["3.5.10[b]", "passwords are cryptographically protected in transit.", "Screen Share"],

  ["3.5.11",    "Determine if authentication information is obscured during the authentication process.", "Screen Share"],

  // ===== IR — Incident Response (3.6.x) =====
  ["3.6.1[a]",  "an operational incident-handling capability is established.", "Document"],
  ["3.6.1[b]",  "the operational incident-handling capability includes preparation.", "Document"],
  ["3.6.1[c]",  "the operational incident-handling capability includes detection.", "Document"],
  ["3.6.1[d]",  "the operational incident-handling capability includes analysis.", "Document"],
  ["3.6.1[e]",  "the operational incident-handling capability includes containment.", "Document"],
  ["3.6.1[f]",  "the operational incident-handling capability includes recovery.", "Document"],
  ["3.6.1[g]",  "the operational incident-handling capability includes user response activities.", "Document"],

  ["3.6.2[a]",  "incidents are tracked.", "Artifact"],
  ["3.6.2[b]",  "incidents are documented.", "Artifact"],
  ["3.6.2[c]",  "authorities to whom incidents are to be reported are identified.", "Document"],
  ["3.6.2[d]",  "organizational officials to whom incidents are to be reported are identified.", "Document"],
  ["3.6.2[e]",  "identified authorities are notified of incidents.", "Screen Share"],
  ["3.6.2[f]",  "identified organizational officials are notified of incidents.", "Artifact"],

  ["3.6.3",     "Determine if the incident response capability is tested.", "Artifact"],

  // ===== MA — Maintenance (3.7.x) =====
  ["3.7.1",     "system maintenance is performed", "Artifact"],

  ["3.7.2[a]",  "tools used to conduct system maintenance are controlled.", "Artifact"],
  ["3.7.2[b]",  "techniques used to conduct system maintenance are controlled.", "Artifact"],
  ["3.7.2[c]",  "mechanisms used to conduct system maintenance are controlled.", "Artifact"],
  ["3.7.2[d]",  "personnel used to conduct system maintenance are controlled.", "Physical Review"],

  ["3.7.3",     "Determine if equipment to be removed from organizational spaces for off-site maintenance is sanitized of any CUI.", "Artifact"],
  ["3.7.4",     "Determine if media containing diagnostic and test programs are checked for malicious code before being used in organizational systems that process, store, or transmit CUI.", "Artifact"],

  ["3.7.5[a]",  "multifactor authentication is used to establish nonlocal maintenance sessions via external network connections.", "Screen Share"],
  ["3.7.5[b]",  "nonlocal maintenance sessions established via external network connections are terminated when nonlocal maintenance is complete.", "Screen Share"],

  ["3.7.6",     "Determine if maintenance personnel without required access authorization are supervised during maintenance activities.", "Document"],

  // ===== MP — Media Protection (3.8.x) =====
  ["3.8.1[a]",  "paper media containing CUI is physically controlled.", "Document"],
  ["3.8.1[b]",  "digital media containing CUI is physically controlled.", "Document"],
  ["3.8.1[c]",  "paper media containing CUI is securely stored.", "Physical Review"],
  ["3.8.1[d]",  "digital media containing CUI is securely stored.", "Physical Review"],

  ["3.8.2",     "Determine if access to CUI on system media is limited to authorized users.", "Artifact"],

  ["3.8.3[a]",  "system media containing CUI is sanitized or destroyed before disposal.", "Document"],
  ["3.8.3[b]",  "system media containing CUI is sanitized before it is released for reuse.", "Document"],

  ["3.8.4[a]",  "media containing CUI is marked with applicable CUI markings.", "Physical Review"],
  ["3.8.4[b]",  "media containing CUI is marked with distribution limitations.", "Physical Review"],

  ["3.8.5[a]",  "access to media containing CUI is controlled.", "Document"],
  ["3.8.5[b]",  "accountability for media containing CUI is maintained during transport outside of controlled areas.", "Artifact"],

  ["3.8.6",     "Determine if the confidentiality of CUI stored on digital media is protected during transport using cryptographic mechanisms or alternative physical safeguards.", "Artifact"],
  ["3.8.7",     "Determine if the use of removable media on system components is controlled.", "Artifact"],
  ["3.8.8",     "Determine if the use of portable storage devices is prohibited when such devices have no identifiable owner.", "Artifact"],
  ["3.8.9",     "Determine if the confidentiality of backup CUI is protected at storage locations.", "Artifact"],

  // ===== PS — Personnel Security (3.9.x) =====
  ["3.9.1",     "Determine if individuals are screened prior to authorizing access to organizational systems containing CUI.", "Artifact"],

  ["3.9.2[a]",  "a policy and/or process for terminating system access and any credentials coincident with personnel actions is established.", "Document"],
  ["3.9.2[b]",  "system access and credentials are terminated consistent with personnel actions such as termination or transfer.", "Artifact"],
  ["3.9.2[c]",  "the system is protected during and after personnel transfer actions.", "Artifact"],

  // ===== PE — Physical and Environmental Protection (3.10.x) =====
  ["3.10.1[a]", "authorized individuals allowed physical access are identified.", "Artifact"],
  ["3.10.1[b]", "physical access to organizational systems is limited to authorized individuals.", "Physical Review"],
  ["3.10.1[c]", "physical access to equipment is limited to authorized individuals.", "Physical Review"],
  ["3.10.1[d]", "physical access to operating environments is limited to authorized individuals.", "Physical Review"],

  ["3.10.2[a]", "the physical facility where organizational systems reside is protected.", "Physical Review"],
  ["3.10.2[b]", "the support infrastructure for organizational systems is protected.", "Physical Review"],
  ["3.10.2[c]", "the physical facility where organizational systems reside is monitored.", "Physical Review"],
  ["3.10.2[d]", "the support infrastructure for organizational systems is monitored.", "Physical Review"],

  ["3.10.3[a]", "visitors are escorted.", "Physical Review"],
  ["3.10.3[b]", "visitor activity is monitored.", "Physical Review"],

  ["3.10.4",    "Determine if audit logs of physical access are maintained.", "Artifact"],

  ["3.10.5[a]", "physical access devices are identified.", "Document"],
  ["3.10.5[b]", "physical access devices are controlled.", "Physical Review"],
  ["3.10.5[c]", "physical access devices are managed.", "Physical Review"],

  ["3.10.6[a]", "safeguarding measures for CUI are defined for alternate work sites.", "Document"],
  ["3.10.6[b]", "safeguarding measures for CUI are enforced for alternate work sites.", "Artifact"],

  // ===== RA — Risk Assessment (3.11.x) =====
  ["3.11.1[a]", "the frequency to assess risk to organizational operations, organizational assets, and individuals is defined.", "Document"],
  ["3.11.1[b]", "risk to organizational operations, organizational assets, and individuals resulting from the operation of an organizational system that processes, stores, or transmits CUI is assessed with the defined frequency.", "Artifact"],

  ["3.11.2[a]", "the frequency to scan for vulnerabilities in organizational systems and applications is defined.", "Document"],
  ["3.11.2[b]", "vulnerability scans are performed on organizational systems with the defined frequency.", "Screen Share"],
  ["3.11.2[c]", "vulnerability scans are performed on applications with the defined frequency.", "Screen Share"],
  ["3.11.2[d]", "vulnerability scans are performed on organizational systems when new vulnerabilities are identified.", "Screen Share"],
  ["3.11.2[e]", "vulnerability scans are performed on applications when new vulnerabilities are identified.", "Screen Share"],

  ["3.11.3[a]", "vulnerabilities are identified.", "Artifact"],
  ["3.11.3[b]", "vulnerabilities are remediated in accordance with risk assessments.", "Artifact"],

  // ===== CA — Security Assessment (3.12.x) =====
  ["3.12.1[a]", "the frequency of security control assessments is defined.", "Document"],
  ["3.12.1[b]", "security controls are assessed with the defined frequency to determine if the controls are effective in their application.", "Artifact"],

  ["3.12.2[a]", "deficiencies and vulnerabilities to be addressed by the plan of action are identified.", "Artifact"],
  ["3.12.2[b]", "a plan of action is developed to correct identified deficiencies and reduce or eliminate identified vulnerabilities.", "Artifact"],
  ["3.12.2[c]", "the plan of action is implemented to correct identified deficiencies and reduce or eliminate identified vulnerabilities.", "Artifact"],

  ["3.12.3",    "Determine if security controls are monitored on an ongoing basis to ensure the continued effectiveness of those controls.", "Artifact"],

  ["3.12.4[a]", "a system security plan is developed.", "Document"],
  ["3.12.4[b]", "the system boundary is described and documented in the system security plan.", "Document"],
  ["3.12.4[c]", "the system environment of operation is described and documented in the system security plan.", "Document"],
  ["3.12.4[d]", "the security requirements identified and approved by the designated authority as non-applicable are identified.", "Document"],
  ["3.12.4[e]", "the method of security requirement implementation is described and documented in the system security plan.", "Document"],
  ["3.12.4[f]", "the relationship with or connection to other systems is described and documented in the system security plan.", "Document"],
  ["3.12.4[g]", "the frequency to update the system security plan is defined.", "Document"],
  ["3.12.4[h]", "system security plan is updated with the defined frequency.", "Document"],

  // ===== SC — System and Communications Protection (3.13.x) =====
  ["3.13.1[a]", "the external system boundary is defined.", "Document"],
  ["3.13.1[b]", "key internal system boundaries are defined.", "Document"],
  ["3.13.1[c]", "communications are monitored at the external system boundary.", "Screen Share"],
  ["3.13.1[d]", "communications are monitored at key internal boundaries.", "Screen Share"],
  ["3.13.1[e]", "communications are controlled at the external system boundary.", "Screen Share"],
  ["3.13.1[f]", "communications are controlled at key internal boundaries.", "Screen Share"],
  ["3.13.1[g]", "communications are protected at the external system boundary.", "Screen Share"],
  ["3.13.1[h]", "communications are protected at key internal boundaries.", "Screen Share"],

  ["3.13.2[a]", "architectural designs that promote effective information security are identified.", "Document"],
  ["3.13.2[b]", "software development techniques that promote effective information security are identified.", "Document"],
  ["3.13.2[c]", "systems engineering principles that promote effective information security are identified.", "Document"],
  ["3.13.2[d]", "identified architectural designs that promote effective information security are employed.", "Artifact"],
  ["3.13.2[e]", "identified software development techniques that promote effective information security are employed.", "Artifact"],
  ["3.13.2[f]", "identified systems engineering principles that promote effective information security are employed.", "Artifact"],

  ["3.13.3[a]", "user functionality is identified.", "Document"],
  ["3.13.3[b]", "system management functionality is identified.", "Document"],
  ["3.13.3[c]", "user functionality is separated from system management functionality.", "Screen Share"],

  ["3.13.4",    "Determine if unauthorized and unintended information transfer via shared system resources is prevented.", "Screen Share"],

  ["3.13.5[a]", "publicly accessible system components are identified.", "Document"],
  ["3.13.5[b]", "subnetworks for publicly accessible system components are physically or logically separated from internal networks.", "Artifact"],

  ["3.13.6[a]", "network communications traffic is denied by default.", "Screen Share"],
  ["3.13.6[b]", "network communications traffic is allowed by exception.", "Screen Share"],

  ["3.13.7",    "Determine if remote devices are prevented from simultaneously establishing non-remote connections with the system and communicating via some other connection to resources in external networks (i.e., split tunneling).", "Screen Share"],

  ["3.13.8[a]", "cryptographic mechanisms intended to prevent unauthorized disclosure of CUI are identified.", "Document"],
  ["3.13.8[b]", "alternative physical safeguards intended to prevent unauthorized disclosure of CUI are identified.", "Document"],
  ["3.13.8[c]", "either cryptographic mechanisms or alternative physical safeguards are implemented to prevent unauthorized disclosure of CUI during transmission.", "Artifact"],

  ["3.13.9[a]", "a period of inactivity to terminate network connections associated with communications sessions is defined.", "Document"],
  ["3.13.9[b]", "network connections associated with communications sessions are terminated at the end of the sessions.", "Screen Share"],
  ["3.13.9[c]", "network connections associated with communications sessions are terminated after the defined period of inactivity.", "Screen Share"],

  ["3.13.10[a]","cryptographic keys are established whenever cryptography is employed.", "Artifact"],
  ["3.13.10[b]","cryptographic keys are managed whenever cryptography is employed.", "Artifact"],

  ["3.13.11",   "Determine if FIPS-validated cryptography is employed to protect the confidentiality of CUI.", "Artifact and Screen Share"],

  ["3.13.12[a]","collaborative computing devices are identified.", "Document"],
  ["3.13.12[b]","collaborative computing devices provide indication to users of devices in use.", "Physical Review"],
  ["3.13.12[c]","remote activation of collaborative computing devices is prohibited.", "Artifact"],

  ["3.13.13[a]","use of mobile code is controlled.", "Screen Share"],
  ["3.13.13[b]","use of mobile code is monitored.", "Screen Share"],

  ["3.13.14[a]","use of Voice over Internet Protocol (VoIP) technologies is controlled.", "Artifact"],
  ["3.13.14[b]","use of Voice over Internet Protocol (VoIP) technologies is monitored.", "Artifact"],

  ["3.13.15",   "Determine if the authenticity of communications sessions is protected.", "Screen Share"],

  ["3.13.16",   "Determine if the confidentiality of CUI at rest is protected.", "Artifact"],

  // ===== SI — System and Information Integrity (3.14.x) =====
  ["3.14.1[a]", "the time within which to identify system flaws is specified.", "Document"],
  ["3.14.1[b]", "system flaws are identified within the specified time frame.", "Screen Share"],
  ["3.14.1[c]", "the time within which to report system flaws is specified.", "Document"],
  ["3.14.1[d]", "system flaws are reported within the specified time frame.", "Screen Share"],
  ["3.14.1[e]", "the time within which to correct system flaws is specified.", "Document"],
  ["3.14.1[f]", "system flaws are corrected within the specified time frame.", "Screen Share"],

  ["3.14.2[a]", "designated locations for malicious code protection are identified.", "Document"],
  ["3.14.2[b]", "protection from malicious code at designated locations is provided.", "Screen Share"],

  ["3.14.3[a]", "response actions to system security alerts and advisories are identified.", "Document"],
  ["3.14.3[b]", "system security alerts and advisories are monitored.", "Artifact"],
  ["3.14.3[c]", "actions in response to system security alerts and advisories are taken.", "Artifact"],

  ["3.14.4",    "Determine if malicious code protection mechanisms are updated when new releases are available.", "Screen Share"],

  ["3.14.5[a]", "the frequency for malicious code scans is defined.", "Document"],
  ["3.14.5[b]", "malicious code scans are performed with the defined frequency.", "Screen Share"],
  ["3.14.5[c]", "real-time malicious code scans of files from external sources as files are downloaded, opened, or executed are performed.", "Screen Share"],

  ["3.14.6[a]", "the system is monitored to detect attacks and indicators of potential attacks.", "Screen Share"],
  ["3.14.6[b]", "inbound communications traffic is monitored to detect attacks and indicators of potential attacks.", "Screen Share"],
  ["3.14.6[c]", "outbound communications traffic is monitored to detect attacks and indicators of potential attacks.", "Screen Share"],

  ["3.14.7[a]", "authorized use of the system is defined.", "Document"],
  ["3.14.7[b]", "unauthorized use of the system is identified.", "Artifact"],
];
/* eslint-enable max-len */

// ---------------------------------------------------------------------------
// Build and export the objectives array
// ---------------------------------------------------------------------------

export const DIBCAC_OBJECTIVES: DIBCACObjective[] = RAW.map(([id, text, std]) =>
  parseObjective(id, text, std)
);

/** Look up a single objective by its ID */
export function getObjective(id: string): DIBCACObjective | undefined {
  return DIBCAC_OBJECTIVES.find((o) => o.objectiveId === id);
}

/** Get all objectives belonging to a parent CMMC control */
export function getObjectivesForControl(controlId: string): DIBCACObjective[] {
  return DIBCAC_OBJECTIVES.filter((o) => o.controlId === controlId);
}

/** Get all objectives in a domain */
export function getObjectivesForDomain(domain: string): DIBCACObjective[] {
  return DIBCAC_OBJECTIVES.filter((o) => o.domain === domain);
}

/** Summary statistics for the full 320-objective set */
export function getObjectiveStats() {
  const total = DIBCAC_OBJECTIVES.length;
  const byStandard = DIBCAC_OBJECTIVES.reduce<Record<string, number>>((acc, o) => {
    acc[o.standard] = (acc[o.standard] ?? 0) + 1;
    return acc;
  }, {});
  const byAutomation = DIBCAC_OBJECTIVES.reduce<Record<string, number>>((acc, o) => {
    acc[o.automation] = (acc[o.automation] ?? 0) + 1;
    return acc;
  }, {});
  return { total, byStandard, byAutomation };
}
