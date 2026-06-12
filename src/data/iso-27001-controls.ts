// =============================================================================
// INDEX DSaaS — ISO/IEC 27001:2022 Annex A Controls
//
// All 93 Annex A controls across the four 2022 themes:
//   A.5  Organizational Controls — 37  (5.1 – 5.37)
//   A.6  People Controls         —  8  (6.1 – 6.8)
//   A.7  Physical Controls       — 14  (7.1 – 7.14)
//   A.8  Technological Controls  — 34  (8.1 – 8.34)
//
// Coverage is HONEST, not inflated. 37 controls have a genuine Microsoft Graph
// evidence mapping and run a real evaluator. The remaining 56 controls are
// organizational, people, physical, or development-lifecycle in nature and
// CANNOT be verified from Graph — they are marked `evaluate_manual_attestation`
// (returns not_assessed, excluded from the compliance-% denominator) so the
// report never fabricates a pass/fail for something it did not actually check.
//
// Source: ISO/IEC 27001:2022, Annex A (titles paraphrased — not reproduced
// verbatim). Control numbering matches the 2022 revision.
// =============================================================================

import type { ComplianceControl, EvidenceQuery, FrameworkId } from '../types.js'

const FW: FrameworkId = 'ISO_27001'

// ─── Themes ─────────────────────────────────────────────────────────────────
const ORG = 'Organizational Controls'
const PPL = 'People Controls'
const PHY = 'Physical Controls'
const TECH = 'Technological Controls'

// ─── Reusable evidence-query factories (prefix keeps query IDs unique) ───────
const caPolicies = (p: string): EvidenceQuery => ({
  id: `${p}-ca`,
  description: 'Conditional Access policies',
  endpoint: '/identity/conditionalAccess/policies',
  method: 'GET',
  category: 'conditionalAccess',
  requiredPermissions: ['Policy.Read.All'],
})
const namedLocations = (p: string): EvidenceQuery => ({
  id: `${p}-loc`,
  description: 'Conditional Access named locations',
  endpoint: '/identity/conditionalAccess/namedLocations',
  method: 'GET',
  category: 'conditionalAccess',
  requiredPermissions: ['Policy.Read.All'],
})
const roleAssignments = (p: string): EvidenceQuery => ({
  id: `${p}-roles`,
  description: 'Directory role assignments',
  endpoint: '/roleManagement/directory/roleAssignments',
  method: 'GET',
  category: 'roleAssignments',
  requiredPermissions: ['RoleManagement.Read.Directory'],
})
const deviceCompliance = (p: string): EvidenceQuery => ({
  id: `${p}-dev`,
  description: 'Intune device compliance policies',
  endpoint: '/deviceManagement/deviceCompliancePolicies',
  method: 'GET',
  category: 'deviceCompliance',
  requiredPermissions: ['DeviceManagementConfiguration.Read.All'],
})
const directoryAudits = (p: string): EvidenceQuery => ({
  id: `${p}-audit`,
  description: 'Directory audit log records',
  endpoint: '/auditLogs/directoryAudits',
  method: 'GET',
  category: 'auditLog',
  requiredPermissions: ['AuditLog.Read.All'],
  topN: 20,
  selectFields: [
    'id',
    'category',
    'activityDisplayName',
    'activityDateTime',
    'result',
    'initiatedBy',
  ],
})
const labelsAudit = (p: string): EvidenceQuery => ({
  id: `${p}-labels`,
  description: 'Information protection / labeling audit activity',
  endpoint: '/auditLogs/directoryAudits',
  method: 'GET',
  category: 'auditLog',
  requiredPermissions: ['AuditLog.Read.All'],
  topN: 20,
  filterExpression: "category eq 'InformationProtectionPolicy'",
  selectFields: ['id', 'category', 'activityDisplayName', 'activityDateTime', 'result'],
})
const secureScore = (p: string): EvidenceQuery => ({
  id: `${p}-score`,
  description: 'Microsoft Secure Score',
  endpoint: '/security/secureScores',
  method: 'GET',
  category: 'identityProtection',
  requiredPermissions: ['SecurityEvents.Read.All'],
  topN: 1,
})
const users = (p: string): EvidenceQuery => ({
  id: `${p}-users`,
  description: 'Directory user accounts',
  endpoint: '/users',
  method: 'GET',
  category: 'identityProtection',
  requiredPermissions: ['User.Read.All'],
  topN: 100,
  selectFields: [
    'id',
    'userPrincipalName',
    'accountEnabled',
    'userType',
    'signInActivity',
    'createdDateTime',
  ],
})
const authMethods = (p: string): EvidenceQuery => ({
  id: `${p}-auth`,
  description: 'User MFA registration details',
  endpoint: '/reports/authenticationMethods/userRegistrationDetails',
  method: 'GET',
  category: 'identityProtection',
  requiredPermissions: ['UserAuthenticationMethod.Read.All'],
  topN: 100,
})
const alerts = (p: string): EvidenceQuery => ({
  id: `${p}-alerts`,
  description: 'Security alerts (Defender / Sentinel)',
  endpoint: '/security/alerts_v2',
  method: 'GET',
  category: 'identityProtection',
  requiredPermissions: ['SecurityEvents.Read.All'],
  topN: 20,
})
const riskDetections = (p: string): EvidenceQuery => ({
  id: `${p}-risk`,
  description: 'Identity Protection risk detections',
  endpoint: '/identityProtection/riskDetections',
  method: 'GET',
  category: 'identityProtection',
  requiredPermissions: ['IdentityRiskEvent.Read.All'],
  topN: 20,
  selectFields: [
    'id',
    'riskEventType',
    'riskLevel',
    'riskState',
    'ipAddress',
    'activityDateTime',
    'userPrincipalName',
  ],
})

// ─── Builders ────────────────────────────────────────────────────────────────

/** Control with a genuine automated Graph evidence mapping. */
function auto(
  controlId: string,
  title: string,
  description: string,
  family: string,
  customEvaluator: string,
  passingCondition: string,
  evidenceQueries: EvidenceQuery[]
): ComplianceControl {
  return {
    controlId,
    title,
    description,
    frameworkId: FW,
    family,
    evidenceQueries,
    evaluationCriteria: { type: 'custom', passingCondition, customEvaluator },
  }
}

/** Organizational / people / physical / dev-lifecycle control — manual attestation only. */
function manual(
  controlId: string,
  title: string,
  description: string,
  family: string
): ComplianceControl {
  return {
    controlId,
    title,
    description,
    frameworkId: FW,
    family,
    evidenceQueries: [],
    evaluationCriteria: {
      type: 'custom',
      passingCondition:
        'Requires documented evidence / manual attestation — not verifiable via automated Microsoft Graph collection.',
      customEvaluator: 'evaluate_manual_attestation',
    },
  }
}

// =============================================================================
// A.5 — ORGANIZATIONAL CONTROLS (37)
// =============================================================================

export const iso27001Controls: ComplianceControl[] = [
  manual(
    'A.5.1',
    'Policies for information security',
    'Define, approve, publish, and review a set of information security policies.',
    ORG
  ),
  manual(
    'A.5.2',
    'Information security roles and responsibilities',
    'Define and allocate information security responsibilities according to organizational needs.',
    ORG
  ),
  auto(
    'A.5.3',
    'Segregation of duties',
    'Separate conflicting duties and areas of responsibility to reduce risk of unauthorized or unintentional modification or misuse.',
    ORG,
    'evaluate_rbac',
    'No single account holds conflicting privileged roles; administrative duties are separated.',
    [roleAssignments('a5_3')]
  ),
  manual(
    'A.5.4',
    'Management responsibilities',
    'Require personnel to apply information security per established policies and procedures.',
    ORG
  ),
  manual(
    'A.5.5',
    'Contact with authorities',
    'Maintain appropriate contacts with relevant authorities.',
    ORG
  ),
  manual(
    'A.5.6',
    'Contact with special interest groups',
    'Maintain contact with special interest groups, security forums, and professional associations.',
    ORG
  ),
  auto(
    'A.5.7',
    'Threat intelligence',
    'Collect and analyze information about information security threats to produce threat intelligence.',
    ORG,
    'evaluate_security_monitoring',
    'Defender/Identity Protection generate threat signals (alerts, risk detections) that are monitored.',
    [alerts('a5_7'), riskDetections('a5_7')]
  ),
  manual(
    'A.5.8',
    'Information security in project management',
    'Integrate information security into project management.',
    ORG
  ),
  auto(
    'A.5.9',
    'Inventory of information and other associated assets',
    'Develop and maintain an inventory of information and associated assets, including owners.',
    ORG,
    'evaluate_asset_inventory',
    'Device and identity inventories are populated across managed endpoints and accounts.',
    [deviceCompliance('a5_9'), users('a5_9')]
  ),
  manual(
    'A.5.10',
    'Acceptable use of information and other associated assets',
    'Identify, document, and implement rules for acceptable use of information and assets.',
    ORG
  ),
  manual(
    'A.5.11',
    'Return of assets',
    'Require personnel and interested parties to return organizational assets on termination or change of role.',
    ORG
  ),
  auto(
    'A.5.12',
    'Classification of information',
    'Classify information according to confidentiality, integrity, availability, and stakeholder requirements.',
    ORG,
    'evaluate_sensitivity_labels',
    'Sensitivity labels / classification taxonomy are deployed and applied.',
    [labelsAudit('a5_12'), secureScore('a5_12')]
  ),
  auto(
    'A.5.13',
    'Labelling of information',
    'Develop and implement procedures for information labelling per the classification scheme.',
    ORG,
    'evaluate_sensitivity_labels',
    'Labels are published and labeling activity is observed in audit logs.',
    [labelsAudit('a5_13'), secureScore('a5_13')]
  ),
  auto(
    'A.5.14',
    'Information transfer',
    'Establish rules, procedures, and agreements for secure information transfer.',
    ORG,
    'evaluate_dlp_policies',
    'DLP policies govern information transfer across Exchange, SharePoint, Teams, and OneDrive.',
    [labelsAudit('a5_14'), secureScore('a5_14')]
  ),
  auto(
    'A.5.15',
    'Access control',
    'Establish and implement rules to control physical and logical access based on business and security requirements.',
    ORG,
    'evaluate_rbac',
    'Role-based access control and Conditional Access enforce access restrictions.',
    [roleAssignments('a5_15'), caPolicies('a5_15')]
  ),
  auto(
    'A.5.16',
    'Identity management',
    'Manage the full life cycle of identities.',
    ORG,
    'evaluate_evidence_exists',
    'Directory identities are uniquely provisioned and lifecycle-managed.',
    [users('a5_16')]
  ),
  auto(
    'A.5.17',
    'Authentication information',
    'Control allocation and management of authentication information.',
    ORG,
    'evaluate_mfa_enforcement',
    'Strong authentication (MFA / phishing-resistant methods) is enforced via Conditional Access.',
    [caPolicies('a5_17'), authMethods('a5_17')]
  ),
  auto(
    'A.5.18',
    'Access rights',
    'Provision, review, modify, and remove access rights per the access control policy.',
    ORG,
    'evaluate_rbac',
    'Access rights are provisioned by role and reviewed; privileged assignments are limited.',
    [roleAssignments('a5_18')]
  ),
  manual(
    'A.5.19',
    'Information security in supplier relationships',
    "Manage information security risks associated with use of suppliers' products and services.",
    ORG
  ),
  manual(
    'A.5.20',
    'Addressing information security within supplier agreements',
    'Establish and agree security requirements with each supplier.',
    ORG
  ),
  manual(
    'A.5.21',
    'Managing information security in the ICT supply chain',
    'Manage information security risks across the ICT product and service supply chain.',
    ORG
  ),
  manual(
    'A.5.22',
    'Monitoring, review and change management of supplier services',
    'Regularly monitor, review, evaluate, and manage change in supplier security practice and service delivery.',
    ORG
  ),
  auto(
    'A.5.23',
    'Information security for use of cloud services',
    'Establish processes for acquisition, use, management, and exit from cloud services per security requirements.',
    ORG,
    'evaluate_evidence_exists',
    'Cloud security posture is tracked (Secure Score) and governed.',
    [secureScore('a5_23')]
  ),
  manual(
    'A.5.24',
    'Information security incident management planning and preparation',
    'Plan and prepare for incident management by defining processes, roles, and responsibilities.',
    ORG
  ),
  auto(
    'A.5.25',
    'Assessment and decision on information security events',
    'Assess information security events and decide whether to categorize them as incidents.',
    ORG,
    'evaluate_security_monitoring',
    'Security events are surfaced as alerts/detections and triaged for incident decisions.',
    [alerts('a5_25'), riskDetections('a5_25')]
  ),
  auto(
    'A.5.26',
    'Response to information security incidents',
    'Respond to information security incidents per documented procedures.',
    ORG,
    'evaluate_security_monitoring',
    'Incident response is supported by Defender/Sentinel alert and detection workflows.',
    [alerts('a5_26'), riskDetections('a5_26')]
  ),
  manual(
    'A.5.27',
    'Learning from information security incidents',
    'Use knowledge gained from incidents to strengthen controls.',
    ORG
  ),
  auto(
    'A.5.28',
    'Collection of evidence',
    'Establish procedures for identification, collection, acquisition, and preservation of evidence.',
    ORG,
    'evaluate_audit_logging',
    'Unified audit logging preserves records suitable for evidentiary use.',
    [directoryAudits('a5_28')]
  ),
  manual(
    'A.5.29',
    'Information security during disruption',
    'Plan how to maintain information security at an appropriate level during disruption.',
    ORG
  ),
  manual(
    'A.5.30',
    'ICT readiness for business continuity',
    'Plan, implement, maintain, and test ICT readiness for business continuity.',
    ORG
  ),
  manual(
    'A.5.31',
    'Legal, statutory, regulatory and contractual requirements',
    'Identify, document, and keep current the legal, statutory, regulatory, and contractual requirements.',
    ORG
  ),
  manual(
    'A.5.32',
    'Intellectual property rights',
    'Implement procedures to protect intellectual property rights.',
    ORG
  ),
  auto(
    'A.5.33',
    'Protection of records',
    'Protect records from loss, destruction, falsification, unauthorized access, and unauthorized release.',
    ORG,
    'evaluate_audit_logging',
    'Audit records are retained and protected against unauthorized modification.',
    [directoryAudits('a5_33')]
  ),
  auto(
    'A.5.34',
    'Privacy and protection of PII',
    'Identify and meet requirements for the preservation of privacy and protection of personal identifiable information.',
    ORG,
    'evaluate_dlp_policies',
    'DLP policies detect and protect PII across collaboration workloads.',
    [labelsAudit('a5_34'), secureScore('a5_34')]
  ),
  manual(
    'A.5.35',
    'Independent review of information security',
    "Review the organization's approach to managing information security independently at planned intervals.",
    ORG
  ),
  manual(
    'A.5.36',
    'Compliance with policies, rules and standards for information security',
    'Regularly review compliance with the information security policy, topic-specific policies, rules, and standards.',
    ORG
  ),
  manual(
    'A.5.37',
    'Documented operating procedures',
    'Document operating procedures for information processing facilities and make them available to personnel who need them.',
    ORG
  ),

  // ===========================================================================
  // A.6 — PEOPLE CONTROLS (8)
  // ===========================================================================
  manual(
    'A.6.1',
    'Screening',
    'Carry out background verification checks on candidates prior to joining and on an ongoing basis.',
    PPL
  ),
  manual(
    'A.6.2',
    'Terms and conditions of employment',
    'State personnel and organizational information security responsibilities in employment agreements.',
    PPL
  ),
  manual(
    'A.6.3',
    'Information security awareness, education and training',
    'Provide personnel with appropriate security awareness, education, and training, with regular updates.',
    PPL
  ),
  manual(
    'A.6.4',
    'Disciplinary process',
    'Formalize and communicate a disciplinary process for personnel who commit security policy violations.',
    PPL
  ),
  auto(
    'A.6.5',
    'Responsibilities after termination or change of employment',
    'Define, enforce, and communicate security responsibilities that remain valid after termination or change of employment.',
    PPL,
    'evaluate_evidence_exists',
    'Leaver accounts are disabled/deprovisioned in the directory upon termination.',
    [users('a6_5')]
  ),
  manual(
    'A.6.6',
    'Confidentiality or non-disclosure agreements',
    'Identify, document, and regularly review confidentiality / NDA requirements.',
    PPL
  ),
  auto(
    'A.6.7',
    'Remote working',
    'Implement security measures when personnel work remotely to protect information accessed, processed, or stored outside premises.',
    PPL,
    'evaluate_device_compliance',
    'Remote access requires compliant, managed devices enforced via Intune and Conditional Access.',
    [deviceCompliance('a6_7'), caPolicies('a6_7')]
  ),
  manual(
    'A.6.8',
    'Information security event reporting',
    'Provide a mechanism for personnel to report observed or suspected security events in a timely manner.',
    PPL
  ),

  // ===========================================================================
  // A.7 — PHYSICAL CONTROLS (14)
  // ===========================================================================
  manual(
    'A.7.1',
    'Physical security perimeters',
    'Define and use security perimeters to protect areas containing information and associated assets.',
    PHY
  ),
  manual(
    'A.7.2',
    'Physical entry',
    'Protect secure areas by appropriate entry controls and access points.',
    PHY
  ),
  manual(
    'A.7.3',
    'Securing offices, rooms and facilities',
    'Design and implement physical security for offices, rooms, and facilities.',
    PHY
  ),
  manual(
    'A.7.4',
    'Physical security monitoring',
    'Continuously monitor premises for unauthorized physical access.',
    PHY
  ),
  manual(
    'A.7.5',
    'Protecting against physical and environmental threats',
    'Design and implement protection against physical and environmental threats.',
    PHY
  ),
  manual(
    'A.7.6',
    'Working in secure areas',
    'Design and implement security measures for working in secure areas.',
    PHY
  ),
  auto(
    'A.7.7',
    'Clear desk and clear screen',
    'Define and enforce clear desk and clear screen rules.',
    PHY,
    'evaluate_device_compliance',
    'Device compliance policies enforce automatic screen lock / inactivity timeout (clear screen).',
    [deviceCompliance('a7_7')]
  ),
  manual('A.7.8', 'Equipment siting and protection', 'Site and protect equipment securely.', PHY),
  auto(
    'A.7.9',
    'Security of assets off-premises',
    'Protect assets located off-premises.',
    PHY,
    'evaluate_device_compliance',
    'Off-premises/mobile devices require storage encryption and compliance enforcement.',
    [deviceCompliance('a7_9')]
  ),
  auto(
    'A.7.10',
    'Storage media',
    'Manage storage media through its life cycle of acquisition, use, transportation, and disposal per classification and handling requirements.',
    PHY,
    'evaluate_device_compliance',
    'Device configuration restricts/monitors removable storage media on managed endpoints.',
    [deviceCompliance('a7_10')]
  ),
  manual(
    'A.7.11',
    'Supporting utilities',
    'Protect information processing facilities from power failures and other disruptions caused by failures in supporting utilities.',
    PHY
  ),
  manual(
    'A.7.12',
    'Cabling security',
    'Protect power and telecommunications cabling carrying data or supporting information services from interception, interference, or damage.',
    PHY
  ),
  manual(
    'A.7.13',
    'Equipment maintenance',
    'Maintain equipment correctly to ensure availability, integrity, and confidentiality of information.',
    PHY
  ),
  manual(
    'A.7.14',
    'Secure disposal or re-use of equipment',
    'Verify that storage media and equipment are sanitized of sensitive data before disposal or re-use.',
    PHY
  ),

  // ===========================================================================
  // A.8 — TECHNOLOGICAL CONTROLS (34)
  // ===========================================================================
  auto(
    'A.8.1',
    'User endpoint devices',
    'Protect information stored on, processed by, or accessible via user endpoint devices.',
    TECH,
    'evaluate_device_compliance',
    'Endpoints are enrolled and governed by Intune device compliance policies.',
    [deviceCompliance('a8_1')]
  ),
  auto(
    'A.8.2',
    'Privileged access rights',
    'Restrict and manage the allocation and use of privileged access rights.',
    TECH,
    'evaluate_rbac',
    'Privileged roles are limited; Global Admin count constrained; least privilege applied.',
    [roleAssignments('a8_2')]
  ),
  auto(
    'A.8.3',
    'Information access restriction',
    'Restrict access to information and other associated assets per the access control policy.',
    TECH,
    'evaluate_rbac',
    'Access is restricted by role and Conditional Access per least-privilege requirements.',
    [roleAssignments('a8_3'), caPolicies('a8_3')]
  ),
  manual(
    'A.8.4',
    'Access to source code',
    'Manage read and write access to source code, development tools, and software libraries.',
    TECH
  ),
  auto(
    'A.8.5',
    'Secure authentication',
    'Implement secure authentication technologies and procedures based on access restrictions and the access control policy.',
    TECH,
    'evaluate_mfa_enforcement',
    'Conditional Access enforces MFA / phishing-resistant authentication.',
    [caPolicies('a8_5'), authMethods('a8_5')]
  ),
  manual(
    'A.8.6',
    'Capacity management',
    'Monitor and adjust the use of resources in line with current and expected capacity requirements.',
    TECH
  ),
  auto(
    'A.8.7',
    'Protection against malware',
    'Implement malware protection supported by appropriate user awareness.',
    TECH,
    'evaluate_evidence_exists',
    'Endpoint malware protection posture is tracked via Secure Score / Defender.',
    [secureScore('a8_7')]
  ),
  auto(
    'A.8.8',
    'Management of technical vulnerabilities',
    'Obtain information about technical vulnerabilities, evaluate exposure, and take appropriate measures.',
    TECH,
    'evaluate_risk_assessment',
    'Secure Score and risk detections track vulnerabilities and remediation actions.',
    [secureScore('a8_8'), riskDetections('a8_8')]
  ),
  auto(
    'A.8.9',
    'Configuration management',
    'Establish, document, implement, monitor, and review configurations of hardware, software, services, and networks.',
    TECH,
    'evaluate_configuration_management',
    'Intune compliance and configuration profiles define and enforce secure baselines.',
    [deviceCompliance('a8_9')]
  ),
  manual(
    'A.8.10',
    'Information deletion',
    'Delete information stored in systems, devices, or other media when no longer required.',
    TECH
  ),
  manual(
    'A.8.11',
    'Data masking',
    'Use data masking per the access control policy and other related policies and business requirements.',
    TECH
  ),
  auto(
    'A.8.12',
    'Data leakage prevention',
    'Apply data leakage prevention measures to systems, networks, and devices that process, store, or transmit sensitive information.',
    TECH,
    'evaluate_dlp_policies',
    'DLP policies are deployed across collaboration workloads to prevent leakage.',
    [labelsAudit('a8_12'), secureScore('a8_12')]
  ),
  manual(
    'A.8.13',
    'Information backup',
    'Maintain and regularly test backup copies of information, software, and systems per the backup policy.',
    TECH
  ),
  manual(
    'A.8.14',
    'Redundancy of information processing facilities',
    'Implement information processing facilities with sufficient redundancy to meet availability requirements.',
    TECH
  ),
  auto(
    'A.8.15',
    'Logging',
    'Produce, store, protect, and analyze logs that record activities, exceptions, faults, and other relevant events.',
    TECH,
    'evaluate_audit_logging',
    'Unified audit logging is active and generating retained records.',
    [directoryAudits('a8_15')]
  ),
  auto(
    'A.8.16',
    'Monitoring activities',
    'Monitor networks, systems, and applications for anomalous behavior and take appropriate action to evaluate potential incidents.',
    TECH,
    'evaluate_security_monitoring',
    'Defender/Identity Protection monitoring surfaces anomalies as alerts and risk detections.',
    [alerts('a8_16'), riskDetections('a8_16')]
  ),
  auto(
    'A.8.17',
    'Clock synchronization',
    'Synchronize the clocks of information processing systems to approved time sources.',
    TECH,
    'evaluate_evidence_exists',
    'Azure AD / Intune-managed systems synchronize time; audit timestamps are consistent.',
    [directoryAudits('a8_17')]
  ),
  auto(
    'A.8.18',
    'Use of privileged utility programs',
    'Restrict and tightly control the use of utility programs that can override system and application controls.',
    TECH,
    'evaluate_rbac',
    'Privileged roles able to run system-override utilities are restricted to a small set.',
    [roleAssignments('a8_18')]
  ),
  auto(
    'A.8.19',
    'Installation of software on operational systems',
    'Implement procedures and measures to securely manage software installation on operational systems.',
    TECH,
    'evaluate_device_compliance',
    'Intune application-control / compliance policies govern software installation on managed systems.',
    [deviceCompliance('a8_19')]
  ),
  auto(
    'A.8.20',
    'Networks security',
    'Secure, manage, and control networks and network devices to protect information in systems and applications.',
    TECH,
    'evaluate_policy_exists',
    'Conditional Access policies and named locations enforce network-level access controls.',
    [caPolicies('a8_20'), namedLocations('a8_20')]
  ),
  manual(
    'A.8.21',
    'Security of network services',
    'Identify, implement, and monitor security mechanisms, service levels, and requirements of network services.',
    TECH
  ),
  manual(
    'A.8.22',
    'Segregation of networks',
    'Segregate groups of information services, users, and information systems in networks.',
    TECH
  ),
  manual(
    'A.8.23',
    'Web filtering',
    'Manage access to external websites to reduce exposure to malicious content.',
    TECH
  ),
  auto(
    'A.8.24',
    'Use of cryptography',
    'Define and implement rules for the effective use of cryptography, including key management.',
    TECH,
    'evaluate_device_compliance',
    'Device compliance requires storage encryption (BitLocker/FileVault) on managed endpoints.',
    [deviceCompliance('a8_24')]
  ),
  manual(
    'A.8.25',
    'Secure development life cycle',
    'Establish and apply rules for the secure development of software and systems.',
    TECH
  ),
  manual(
    'A.8.26',
    'Application security requirements',
    'Identify, specify, and approve information security requirements when developing or acquiring applications.',
    TECH
  ),
  manual(
    'A.8.27',
    'Secure system architecture and engineering principles',
    'Establish, document, maintain, and apply secure system engineering principles.',
    TECH
  ),
  manual(
    'A.8.28',
    'Secure coding',
    'Apply secure coding principles to software development.',
    TECH
  ),
  manual(
    'A.8.29',
    'Security testing in development and acceptance',
    'Define and implement security testing processes in the development life cycle.',
    TECH
  ),
  manual(
    'A.8.30',
    'Outsourced development',
    'Direct, monitor, and review activities related to outsourced system development.',
    TECH
  ),
  manual(
    'A.8.31',
    'Separation of development, test and production environments',
    'Separate and secure development, testing, and production environments.',
    TECH
  ),
  auto(
    'A.8.32',
    'Change management',
    'Subject changes to information processing facilities and systems to change management procedures.',
    TECH,
    'evaluate_audit_logging',
    'Configuration and policy changes are captured in directory audit logs with actor and timestamp.',
    [directoryAudits('a8_32')]
  ),
  manual(
    'A.8.33',
    'Test information',
    'Appropriately select, protect, and manage test information.',
    TECH
  ),
  manual(
    'A.8.34',
    'Protection of information systems during audit testing',
    'Plan and agree audit tests and other assurance activities to minimize impact on operational systems.',
    TECH
  ),
]
