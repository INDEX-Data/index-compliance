// =============================================================================
// INDEX DSaaS — FINRA Cybersecurity Controls
//
// Financial Industry Regulatory Authority (FINRA) Cybersecurity Program
// Requirements, based on:
//   - FINRA Report on Cybersecurity Practices (2015, 2018, 2019 updates)
//   - FINRA Cybersecurity Checklist for Broker-Dealers (2023)
//   - SEC Regulation S-P / Safeguards Rule obligations
//
// Organized by FINRA's six cybersecurity program pillars:
//   1. Cybersecurity Governance & Risk Management
//   2. Access Controls & Identity Management
//   3. Data Classification & Loss Prevention
//   4. Vendor & Third-Party Management
//   5. Security Monitoring & Incident Response
//   6. Business Continuity & Recovery
//
// All evidence collected via Microsoft Graph API (M365 / Azure AD / Intune).
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.ts";

const FW: FrameworkId = "FINRA";

export const finraControls: ComplianceControl[] = [

  // ===========================================================================
  // PILLAR 1 — CYBERSECURITY GOVERNANCE & RISK MANAGEMENT
  // ===========================================================================

  {
    controlId: "FINRA-GOV-1",
    title: "Cybersecurity Governance Program",
    description: "Establish a written cybersecurity program with board-level oversight. Senior management must be informed of cybersecurity risks and the program must be reviewed at least annually.",
    frameworkId: FW,
    family: "Governance & Risk Management",
    evidenceQueries: [
      {
        id: "finra-gov1-score",
        description: "Microsoft Secure Score — overall security governance posture",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "finra-gov1-profiles",
        description: "Secure Score improvement actions — governance gaps",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security posture is tracked and governance metrics (Secure Score) are actively monitored",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "FINRA-GOV-2",
    title: "Cybersecurity Risk Assessment",
    description: "Conduct periodic cybersecurity risk assessments to identify and prioritize threats to customer data and firm systems. Assessments must be documented and acted upon.",
    frameworkId: FW,
    family: "Governance & Risk Management",
    evidenceQueries: [
      {
        id: "finra-gov2-score",
        description: "Microsoft Secure Score — quantified risk posture assessment",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
      },
      {
        id: "finra-gov2-riskdetect",
        description: "Identity risk detections — active threats identified in risk assessment",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 20,
        selectFields: ["id", "riskType", "riskLevel", "riskState", "detectedDateTime"],
      },
      {
        id: "finra-gov2-riskyusers",
        description: "Risky users — personnel-level risk findings",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskyUser.Read.All"],
        topN: 10,
        selectFields: ["id", "userDisplayName", "riskLevel", "riskState"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Formal risk assessment process in place; threats identified and tracked via Secure Score and Identity Protection",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "FINRA-GOV-3",
    title: "Security Policies and Procedures",
    description: "Maintain written cybersecurity policies and procedures covering all major security domains. Policies must be reviewed and updated at least annually.",
    frameworkId: FW,
    family: "Governance & Risk Management",
    evidenceQueries: [
      {
        id: "finra-gov3-ca",
        description: "Conditional Access policies — technical expression of security policies",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "finra-gov3-compliance",
        description: "Device compliance policies — endpoint security policy baseline",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "finra-gov3-authpolicy",
        description: "Authorization policy — tenant-wide security configuration",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security policies are operationalized in CA, device compliance, and tenant authorization settings",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  // ===========================================================================
  // PILLAR 2 — ACCESS CONTROLS & IDENTITY MANAGEMENT
  // ===========================================================================

  {
    controlId: "FINRA-ACC-1",
    title: "Multi-Factor Authentication",
    description: "Require multi-factor authentication for all employee and privileged user access to firm systems, customer data, and email. MFA is a core FINRA cybersecurity expectation.",
    frameworkId: FW,
    family: "Access Controls & Identity Management",
    evidenceQueries: [
      {
        id: "finra-acc1-ca",
        description: "Conditional Access policies enforcing MFA for all users",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "finra-acc1-mfa",
        description: "MFA registration status for all user accounts",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "MFA is enforced for all accounts via Conditional Access; high MFA registration rate confirmed",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "FINRA-ACC-2",
    title: "Privileged Access Management",
    description: "Implement controls for privileged accounts including separation of duties, least privilege, and monitoring of administrative actions. Limit the number of privileged users.",
    frameworkId: FW,
    family: "Access Controls & Identity Management",
    evidenceQueries: [
      {
        id: "finra-acc2-roles",
        description: "Directory role assignments — privileged user inventory",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "finra-acc2-roledefs",
        description: "Role definitions — scope of privileged access granted",
        endpoint: "/roleManagement/directory/roleDefinitions",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 25,
      },
      {
        id: "finra-acc2-audit",
        description: "Audit logs for privileged operations",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Privileged roles are minimal (≤5 Global Admins); least-privilege roles used; admin actions are audited",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "FINRA-ACC-3",
    title: "User Access Reviews",
    description: "Conduct periodic reviews of user access rights to ensure access remains appropriate. Remove or disable accounts for terminated employees promptly.",
    frameworkId: FW,
    family: "Access Controls & Identity Management",
    evidenceQueries: [
      {
        id: "finra-acc3-guests",
        description: "Guest and external user accounts — potential stale access",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 50,
        selectFields: ["id", "displayName", "userPrincipalName", "userType", "externalUserState", "createdDateTime"],
        filterExpression: "userType eq 'Guest'",
      },
      {
        id: "finra-acc3-audit",
        description: "User lifecycle audit events (creation, deletion, disable)",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'UserManagement'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "External guest access is governed and restricted; user lifecycle events are audited",
      customEvaluator: "evaluate_guest_access",
    },
  },

  // ===========================================================================
  // PILLAR 3 — DATA CLASSIFICATION & LOSS PREVENTION
  // ===========================================================================

  {
    controlId: "FINRA-DATA-1",
    title: "Customer Data Classification",
    description: "Classify customer and firm data by sensitivity. Apply appropriate controls to protect customer PII and NPI (nonpublic personal information) in accordance with Regulation S-P.",
    frameworkId: FW,
    family: "Data Classification & Loss Prevention",
    evidenceQueries: [
      {
        id: "finra-data1-labels",
        description: "Information protection label policy audit activity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "finra-data1-score",
        description: "Secure Score — data classification and DLP signal",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Sensitivity labels are deployed and actively applied to classify customer NPI / firm data",
      customEvaluator: "evaluate_sensitivity_labels",
    },
  },

  {
    controlId: "FINRA-DATA-2",
    title: "Data Loss Prevention",
    description: "Implement DLP controls to prevent unauthorized disclosure of customer PII and NPI. DLP should cover email, file sharing, and cloud storage of regulated data.",
    frameworkId: FW,
    family: "Data Classification & Loss Prevention",
    evidenceQueries: [
      {
        id: "finra-data2-dlp",
        description: "DLP policy audit events — protection of customer NPI in transit",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "finra-data2-score",
        description: "Secure Score — DLP and information protection posture",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "DLP policies are deployed and enforce restrictions on NPI/PII sharing across M365 workloads",
      customEvaluator: "evaluate_dlp_policies",
    },
  },

  {
    controlId: "FINRA-DATA-3",
    title: "Encryption of Customer Data",
    description: "Encrypt customer data at rest and in transit. This includes email encryption, device encryption (BitLocker), and ensuring data transmission uses TLS.",
    frameworkId: FW,
    family: "Data Classification & Loss Prevention",
    evidenceQueries: [
      {
        id: "finra-data3-devicecompliance",
        description: "Device compliance policies requiring BitLocker / disk encryption",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "finra-data3-ca",
        description: "Conditional Access policies requiring compliant (encrypted) devices",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance policies enforce encryption at rest; CA policies require compliant devices for access",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  // ===========================================================================
  // PILLAR 4 — VENDOR & THIRD-PARTY MANAGEMENT
  // ===========================================================================

  {
    controlId: "FINRA-VND-1",
    title: "Third-Party Vendor Due Diligence",
    description: "Conduct due diligence on vendors with access to firm systems or customer data. Establish written agreements addressing cybersecurity responsibilities and incident notification requirements.",
    frameworkId: FW,
    family: "Vendor & Third-Party Management",
    evidenceQueries: [
      {
        id: "finra-vnd1-apps",
        description: "Enterprise applications with access to firm data",
        endpoint: "/applications",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Application.Read.All"],
        topN: 30,
        selectFields: ["id", "displayName", "signInAudience", "createdDateTime", "publisherDomain"],
      },
      {
        id: "finra-vnd1-serviceprinc",
        description: "Service principals (vendor integrations) in the tenant",
        endpoint: "/servicePrincipals",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Application.Read.All"],
        topN: 30,
        selectFields: ["id", "displayName", "appId", "accountEnabled", "servicePrincipalType"],
        filterExpression: "servicePrincipalType eq 'Application'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Third-party application registrations are inventoried; only approved vendor applications have tenant access",
      customEvaluator: "evaluate_asset_inventory",
    },
  },

  {
    controlId: "FINRA-VND-2",
    title: "External Access Controls",
    description: "Control and monitor external party access to firm systems. Guest accounts and external identities must be managed with appropriate restrictions.",
    frameworkId: FW,
    family: "Vendor & Third-Party Management",
    evidenceQueries: [
      {
        id: "finra-vnd2-guests",
        description: "Guest and external users with tenant access",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 50,
        selectFields: ["id", "displayName", "userPrincipalName", "userType", "externalUserState", "createdDateTime"],
        filterExpression: "userType eq 'Guest'",
      },
      {
        id: "finra-vnd2-policy",
        description: "External collaboration and guest invitation policy settings",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "External guest access is restricted with a controlled invitation policy; stale accounts are reviewed",
      customEvaluator: "evaluate_guest_access",
    },
  },

  // ===========================================================================
  // PILLAR 5 — SECURITY MONITORING & INCIDENT RESPONSE
  // ===========================================================================

  {
    controlId: "FINRA-MON-1",
    title: "Security Event Monitoring",
    description: "Implement continuous monitoring of systems for cybersecurity events. Monitor for unauthorized access, anomalous behavior, and potential breaches affecting customer accounts.",
    frameworkId: FW,
    family: "Security Monitoring & Incident Response",
    evidenceQueries: [
      {
        id: "finra-mon1-alerts",
        description: "Security alerts from Defender — active threat monitoring",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category"],
        apiVersion: "v1",
      },
      {
        id: "finra-mon1-riskdetect",
        description: "Identity risk detections — anomalous sign-in and behavior monitoring",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 20,
        selectFields: ["id", "riskType", "riskLevel", "riskState", "detectedDateTime"],
      },
      {
        id: "finra-mon1-signin",
        description: "Sign-in logs — authentication monitoring",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["userPrincipalName", "createdDateTime", "status", "ipAddress", "riskLevelDuringSignIn"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Continuous security monitoring is active via Defender alerts, Identity Protection, and sign-in log analysis",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "FINRA-MON-2",
    title: "Audit Logging and Log Retention",
    description: "Maintain audit logs sufficient to reconstruct cybersecurity incidents. FINRA expects firms to retain logs for a minimum period to support investigation and regulatory inquiries.",
    frameworkId: FW,
    family: "Security Monitoring & Incident Response",
    evidenceQueries: [
      {
        id: "finra-mon2-audit",
        description: "Directory audit logs — user and admin activity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
      {
        id: "finra-mon2-signin",
        description: "Sign-in logs — access records for regulatory retention",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["userPrincipalName", "createdDateTime", "status", "appDisplayName", "ipAddress"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Audit logging is active in M365; logs capture authentication and admin activity for regulatory retention",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "FINRA-MON-3",
    title: "Incident Response Plan",
    description: "Develop and maintain a written cybersecurity incident response plan. The plan must define escalation, containment, notification, and recovery procedures for cyber incidents.",
    frameworkId: FW,
    family: "Security Monitoring & Incident Response",
    evidenceQueries: [
      {
        id: "finra-mon3-alerts",
        description: "Active security alerts — test of incident detection capability",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "createdDateTime"],
        apiVersion: "v1",
      },
      {
        id: "finra-mon3-riskyusers",
        description: "Risky users requiring incident response actions",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskyUser.Read.All"],
        topN: 10,
        selectFields: ["id", "userDisplayName", "riskLevel", "riskState"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Incident detection tooling (Defender, Identity Protection) is active; open incidents are being triaged",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "FINRA-MON-4",
    title: "Cybersecurity Training and Awareness",
    description: "Provide cybersecurity awareness training for all employees. Training must cover phishing, social engineering, data handling, and reporting procedures.",
    frameworkId: FW,
    family: "Security Monitoring & Incident Response",
    evidenceQueries: [
      {
        id: "finra-mon4-mfa",
        description: "MFA registration rates — indicator of user security awareness",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
      {
        id: "finra-mon4-ca",
        description: "Conditional Access policies — terms of use enforcement",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "High MFA adoption and ToU enforcement indicate active security awareness culture",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  // ===========================================================================
  // PILLAR 6 — BUSINESS CONTINUITY & RECOVERY
  // ===========================================================================

  {
    controlId: "FINRA-BCR-1",
    title: "Business Continuity Planning",
    description: "Maintain a business continuity plan addressing cyber incidents. The plan must cover recovery of critical systems and customer data restoration procedures.",
    frameworkId: FW,
    family: "Business Continuity & Recovery",
    evidenceQueries: [
      {
        id: "finra-bcr1-score",
        description: "Secure Score — resilience and recovery control signals",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "finra-bcr1-audit",
        description: "Audit log activity demonstrating operational continuity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security posture evidence indicates active management; operational audit trail supports continuity planning",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "FINRA-BCR-2",
    title: "Endpoint Security & Patch Management",
    description: "Maintain current patches on all systems. Implement endpoint protection including antivirus, anti-malware, and vulnerability management to reduce attack surface.",
    frameworkId: FW,
    family: "Business Continuity & Recovery",
    evidenceQueries: [
      {
        id: "finra-bcr2-compliance",
        description: "Device compliance policies enforcing OS version and patch requirements",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "finra-bcr2-config",
        description: "Device configuration profiles with security baseline settings",
        endpoint: "/deviceManagement/deviceConfigurations",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Intune device compliance and configuration policies enforce patching and endpoint security baselines",
      customEvaluator: "evaluate_configuration_management",
    },
  },
];
