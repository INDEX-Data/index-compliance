// =============================================================================
// INDEX DSaaS - NIST Cybersecurity Framework 2.0 Control Mappings
// Maps NIST CSF 2.0 controls to Microsoft Graph API evidence queries
//
// Functions: GV (Govern), ID (Identify), PR (Protect),
//            DE (Detect),  RS (Respond),  RC (Recover)
//
// Coverage targets controls that can be meaningfully assessed via
// Microsoft Graph / Microsoft 365 / Intune APIs.
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";

const FRAMEWORK: FrameworkId = "NIST_CSF";

export const nistCsfControls: ComplianceControl[] = [

  // ===========================================================================
  // GV — GOVERN
  // Establishes and monitors the organization's cybersecurity risk management
  // ===========================================================================

  {
    controlId: "GV.OC-01",
    title: "Organizational Mission and Objectives",
    description: "The organizational mission is understood and informs cybersecurity risk management decisions.",
    frameworkId: FRAMEWORK,
    family: "Govern: Organizational Context",
    evidenceQueries: [
      {
        id: "gv-oc-01-org-info",
        description: "Azure AD organization details and contact information",
        endpoint: "/organization",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Organization.Read.All"],
        selectFields: ["id", "displayName", "securityComplianceNotificationPhones", "securityComplianceNotificationMails", "technicalNotificationMails", "onPremisesSyncEnabled"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Organization profile is configured with security notification contacts",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "GV.OC-03",
    title: "Legal and Regulatory Requirements",
    description: "Legal, regulatory, and contractual cybersecurity obligations are understood and managed.",
    frameworkId: FRAMEWORK,
    family: "Govern: Organizational Context",
    evidenceQueries: [
      {
        id: "gv-oc-03-compliance-policies",
        description: "Intune device compliance policies representing enforced security obligations",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "gv-oc-03-ca-policies",
        description: "Conditional Access policies representing access control obligations",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Compliance and access control policies are established in the tenant",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  {
    controlId: "GV.RM-01",
    title: "Cybersecurity Risk Management Strategy",
    description: "An organizational cybersecurity risk management strategy is established, communicated, and monitored.",
    frameworkId: FRAMEWORK,
    family: "Govern: Risk Management",
    evidenceQueries: [
      {
        id: "gv-rm-01-secure-score",
        description: "Microsoft Secure Score — proxy for whether security posture is actively tracked",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "gv-rm-01-score-profiles",
        description: "Secure Score control profiles — improvement actions being tracked",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
        selectFields: ["id", "title", "controlCategory", "implementationStatus"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Microsoft Secure Score is active and improvement actions are tracked",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "GV.RM-02",
    title: "Risk Appetite and Tolerance",
    description: "Risk tolerance and appetite are established and communicated for cybersecurity risk decisions.",
    frameworkId: FRAMEWORK,
    family: "Govern: Risk Management",
    evidenceQueries: [
      {
        id: "gv-rm-02-named-locations",
        description: "Named / trusted locations defined in Conditional Access (reflects risk tolerance for network access)",
        endpoint: "/identity/conditionalAccess/namedLocations",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "gv-rm-02-auth-strength",
        description: "Authentication strength policies reflecting required security level",
        endpoint: "/policies/authenticationStrengthPolicies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Named locations and authentication strength policies define enforced risk boundaries",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  {
    controlId: "GV.RR-02",
    title: "Roles and Responsibilities",
    description: "Roles and responsibilities for cybersecurity are established, communicated, and enforced.",
    frameworkId: FRAMEWORK,
    family: "Govern: Roles, Responsibilities, and Authorities",
    evidenceQueries: [
      {
        id: "gv-rr-02-role-assignments",
        description: "Directory role assignments — security roles assigned to specific users",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "gv-rr-02-role-defs",
        description: "Available directory roles to verify security roles are configured",
        endpoint: "/roleManagement/directory/roleDefinitions",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 10,
        selectFields: ["id", "displayName", "isBuiltIn", "isEnabled"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security roles are assigned and active in the directory",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "GV.PO-01",
    title: "Cybersecurity Policies",
    description: "Cybersecurity policies that address purpose, scope, roles, responsibilities, and compliance are established and communicated.",
    frameworkId: FRAMEWORK,
    family: "Govern: Policy",
    evidenceQueries: [
      {
        id: "gv-po-01-ca-policies",
        description: "Conditional Access policies (enforceable security policies)",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "gv-po-01-auth-policy",
        description: "Authentication methods policy (platform security policy)",
        endpoint: "/policies/authenticationMethodsPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security policies are configured and active in the tenant",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  {
    controlId: "GV.OV-01",
    title: "Cybersecurity Risk Oversight",
    description: "Cybersecurity risk management results are communicated and used to inform organizational priorities.",
    frameworkId: FRAMEWORK,
    family: "Govern: Oversight",
    evidenceQueries: [
      {
        id: "gv-ov-01-secure-scores",
        description: "Secure Score history showing trend over time",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
      },
      {
        id: "gv-ov-01-score-profiles",
        description: "Improvement actions with implementation status showing ongoing oversight",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "implementationStatus", "lastModifiedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Secure Score history shows active monitoring and improvement action updates",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  // ===========================================================================
  // ID — IDENTIFY
  // Understanding the organization's assets, risks, and supply chains
  // ===========================================================================

  {
    controlId: "ID.AM-01",
    title: "Hardware Asset Inventory",
    description: "Inventories of hardware assets (devices) are maintained.",
    frameworkId: FRAMEWORK,
    family: "Identify: Asset Management",
    evidenceQueries: [
      {
        id: "id-am-01-managed-devices",
        description: "Intune-managed device inventory",
        endpoint: "/deviceManagement/managedDevices",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
        topN: 10,
        selectFields: ["id", "deviceName", "operatingSystem", "osVersion", "complianceState", "enrolledDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Managed device inventory is populated with enrolled devices",
      customEvaluator: "evaluate_asset_inventory",
    },
  },

  {
    controlId: "ID.AM-02",
    title: "Software and Service Asset Inventory",
    description: "Inventories of software, services, and application assets are maintained.",
    frameworkId: FRAMEWORK,
    family: "Identify: Asset Management",
    evidenceQueries: [
      {
        id: "id-am-02-applications",
        description: "Azure AD app registrations inventory",
        endpoint: "/applications",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Application.Read.All"],
        topN: 10,
        selectFields: ["id", "displayName", "createdDateTime", "signInAudience"],
      },
      {
        id: "id-am-02-service-principals",
        description: "Enterprise applications and service principals",
        endpoint: "/servicePrincipals",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Application.Read.All"],
        topN: 10,
        selectFields: ["id", "displayName", "servicePrincipalType", "createdDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Application and service principal inventory is maintained in Azure AD",
      customEvaluator: "evaluate_asset_inventory",
    },
  },

  {
    controlId: "ID.AM-05",
    title: "External Identity and Guest Account Management",
    description: "External users, identities, and access are managed and limited to what is necessary.",
    frameworkId: FRAMEWORK,
    family: "Identify: Asset Management",
    evidenceQueries: [
      {
        id: "id-am-05-guest-users",
        description: "Guest/external user accounts in the directory",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 20,
        selectFields: ["id", "displayName", "userType", "accountEnabled", "createdDateTime", "lastSignInDateTime"],
        filterExpression: "userType eq 'Guest'",
      },
      {
        id: "id-am-05-external-collab",
        description: "External collaboration / B2B settings",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "External guest accounts are limited and B2B collaboration is restricted to approved domains",
      customEvaluator: "evaluate_guest_access",
    },
  },

  {
    controlId: "ID.AM-07",
    title: "Data Classification and Information Protection",
    description: "Inventories of data and corresponding protection requirements are established and maintained.",
    frameworkId: FRAMEWORK,
    family: "Identify: Asset Management",
    evidenceQueries: [
      {
        id: "id-am-07-info-protection-audit",
        description: "Information protection policy audit events",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "id-am-07-secure-score-labels",
        description: "Secure Score for information protection (sensitivity labels)",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "controlCategory", "implementationStatus"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Data classification policies and sensitivity labels are active",
      customEvaluator: "evaluate_sensitivity_labels",
    },
  },

  {
    controlId: "ID.AM-08",
    title: "Systems and Software Lifecycle Management",
    description: "Systems, hardware, software, and services are managed throughout their lifecycle.",
    frameworkId: FRAMEWORK,
    family: "Identify: Asset Management",
    evidenceQueries: [
      {
        id: "id-am-08-device-config",
        description: "Device configuration profiles managing software lifecycle",
        endpoint: "/deviceManagement/deviceConfigurations",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
        topN: 10,
        selectFields: ["id", "displayName", "createdDateTime", "lastModifiedDateTime"],
      },
      {
        id: "id-am-08-update-policies",
        description: "Intune update policies for OS and software patching",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device lifecycle management and update policies are configured in Intune",
      customEvaluator: "evaluate_configuration_management",
    },
  },

  {
    controlId: "ID.RA-01",
    title: "Vulnerability Identification",
    description: "Vulnerabilities in assets are identified, validated, and recorded.",
    frameworkId: FRAMEWORK,
    family: "Identify: Risk Assessment",
    evidenceQueries: [
      {
        id: "id-ra-01-secure-score",
        description: "Microsoft Secure Score — overall posture and improvement gaps",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "id-ra-01-score-profiles",
        description: "Secure Score improvement actions showing unresolved vulnerability gaps",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "controlCategory", "implementationStatus", "maxScore", "rank"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Secure Score is being tracked with identified improvement actions",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "ID.RA-03",
    title: "Threat Identification",
    description: "Internal and external threats to the organization are identified and recorded.",
    frameworkId: FRAMEWORK,
    family: "Identify: Risk Assessment",
    evidenceQueries: [
      {
        id: "id-ra-03-risk-detections",
        description: "Microsoft Entra ID Protection risk detections",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskEventType", "riskLevel", "riskState", "detectedDateTime", "ipAddress"],
      },
      {
        id: "id-ra-03-risky-users",
        description: "Risky users flagged by Identity Protection",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "userPrincipalName", "riskLevel", "riskState", "riskLastUpdatedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Identity threat detection is active via Microsoft Entra ID Protection",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "ID.RA-05",
    title: "Risk Prioritization",
    description: "Risks are prioritized based on likelihood, impact, and exposure.",
    frameworkId: FRAMEWORK,
    family: "Identify: Risk Assessment",
    evidenceQueries: [
      {
        id: "id-ra-05-score-profiles-ranked",
        description: "Secure Score improvement actions ordered by priority score",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "rank", "maxScore", "controlCategory", "implementationStatus", "remediation"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security improvement actions are ranked by priority and remediation is available",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "ID.IM-01",
    title: "Improvements Identified from Assessments",
    description: "Improvements are identified from cybersecurity evaluations, assessments, and exercises.",
    frameworkId: FRAMEWORK,
    family: "Identify: Improvement",
    evidenceQueries: [
      {
        id: "id-im-01-score-history",
        description: "Secure Score history showing improvement over time",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
      },
      {
        id: "id-im-01-directory-audits",
        description: "Recent policy and configuration change audit events",
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
      passingCondition: "Secure Score history and audit logs show active security improvements",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  // ===========================================================================
  // PR — PROTECT
  // Safeguards to manage cybersecurity risk
  // ===========================================================================

  {
    controlId: "PR.AA-01",
    title: "Identity and Credential Management",
    description: "Identities and credentials for authorized users, services, and hardware are managed.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-01-mfa-registration",
        description: "User MFA and authentication method registration coverage",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 50,
        selectFields: ["id", "userPrincipalName", "isMfaRegistered", "isMfaCapable", "isPasswordlessCapable", "methodsRegistered"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Users have MFA methods registered and are MFA capable",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "PR.AA-02",
    title: "Identity Proofing and Binding",
    description: "Identities are proofed and bound to credentials and authenticators.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-02-identity-verification",
        description: "User identity states (synced vs cloud, licensed, etc.)",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 20,
        selectFields: ["id", "userPrincipalName", "accountEnabled", "onPremisesSyncEnabled", "createdDateTime", "userType"],
      },
      {
        id: "pr-aa-02-auth-methods",
        description: "Authentication methods policy — allowed credential types",
        endpoint: "/policies/authenticationMethodsPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "User accounts are bound to strong authentication methods",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "PR.AA-03",
    title: "User Authentication",
    description: "Users, services, and hardware are authenticated using secure methods.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-03-ca-policies",
        description: "Conditional Access policies enforcing authentication requirements",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "pr-aa-03-mfa-registration",
        description: "User MFA registration status",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 50,
        selectFields: ["id", "userPrincipalName", "isMfaRegistered", "isMfaCapable", "methodsRegistered"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "MFA is enforced via Conditional Access for all user access",
      customEvaluator: "evaluate_mfa_enforcement",
    },
  },

  {
    controlId: "PR.AA-04",
    title: "Passwordless and Phishing-Resistant Authentication",
    description: "Strong, phishing-resistant authentication is in use where applicable.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-04-passwordless",
        description: "Users enrolled in passwordless authentication methods",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 50,
        selectFields: ["id", "userPrincipalName", "isPasswordlessCapable", "methodsRegistered"],
      },
      {
        id: "pr-aa-04-auth-strength",
        description: "Authentication strength policies requiring phishing-resistant methods",
        endpoint: "/policies/authenticationStrengthPolicies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Passwordless-capable users exist and authentication strength policies are defined",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "PR.AA-05",
    title: "Access Permissions and Entitlements",
    description: "Access permissions, entitlements, and authorizations are managed, incorporating the principles of least privilege and separation of duties.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-05-role-assignments",
        description: "Directory privileged role assignments",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "pr-aa-05-role-definitions",
        description: "Available directory roles",
        endpoint: "/roleManagement/directory/roleDefinitions",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 20,
        selectFields: ["id", "displayName", "isBuiltIn", "isEnabled"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Privileged role assignments follow least privilege with limited Global Admins",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "PR.AA-06",
    title: "Physical Access Management",
    description: "Physical access to assets is managed, monitored, and restricted.",
    frameworkId: FRAMEWORK,
    family: "Protect: Identity Management and Access Control",
    evidenceQueries: [
      {
        id: "pr-aa-06-device-compliance",
        description: "Device compliance policies including encryption and physical security controls",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "pr-aa-06-managed-devices",
        description: "Enrolled managed devices showing physical asset control",
        endpoint: "/deviceManagement/managedDevices",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
        topN: 5,
        selectFields: ["id", "deviceName", "complianceState", "isEncrypted", "operatingSystem"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Devices are enrolled in management with encryption compliance required",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "PR.AT-01",
    title: "User Awareness and Training",
    description: "Personnel receive awareness and training so they can perform their cybersecurity-related duties.",
    frameworkId: FRAMEWORK,
    family: "Protect: Awareness and Training",
    evidenceQueries: [
      {
        id: "pr-at-01-secure-score-training",
        description: "Secure Score controls related to security awareness and training",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
        selectFields: ["id", "title", "controlCategory", "implementationStatus"],
        filterExpression: "controlCategory eq 'Data'",
      },
      {
        id: "pr-at-01-audit-training",
        description: "Directory audit events for user security configuration activities",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 5,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security training controls are tracked in Secure Score",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "PR.DS-01",
    title: "Data at Rest Protection",
    description: "The confidentiality, integrity, and availability of data-at-rest are protected.",
    frameworkId: FRAMEWORK,
    family: "Protect: Data Security",
    evidenceQueries: [
      {
        id: "pr-ds-01-device-compliance",
        description: "Device compliance policies requiring encryption",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance policies require encryption on all managed devices",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "PR.DS-02",
    title: "Data in Transit Protection",
    description: "Sensitive data is protected from unauthorized disclosure during transmission.",
    frameworkId: FRAMEWORK,
    family: "Protect: Data Security",
    evidenceQueries: [
      {
        id: "pr-ds-02-aip-audit",
        description: "Audit events for information protection and labeling activity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "pr-ds-02-secure-score-aip",
        description: "Secure Score signals for AIP / DLP enablement",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Sensitivity labels and DLP policies are classifying and protecting sensitive data",
      customEvaluator: "evaluate_sensitivity_labels",
    },
  },

  {
    controlId: "PR.DS-10",
    title: "Data Integrity Protection",
    description: "The integrity of data is protected against unauthorized modification.",
    frameworkId: FRAMEWORK,
    family: "Protect: Data Security",
    evidenceQueries: [
      {
        id: "pr-ds-10-audit-logs",
        description: "Directory audit logs capturing data modification events",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
      {
        id: "pr-ds-10-ca-policies",
        description: "Conditional Access policies preventing unauthorized access to data",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Audit logging and access controls protect data integrity",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "PR.PS-01",
    title: "Configuration Management",
    description: "Configuration management practices are established and applied.",
    frameworkId: FRAMEWORK,
    family: "Protect: Platform Security",
    evidenceQueries: [
      {
        id: "pr-ps-01-compliance-policies",
        description: "Device compliance policies (configuration baselines)",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "pr-ps-01-config-profiles",
        description: "Device configuration profiles (security settings)",
        endpoint: "/deviceManagement/deviceConfigurations",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
        topN: 10,
        selectFields: ["id", "displayName", "createdDateTime", "lastModifiedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance policies and configuration profiles are established in Intune",
      customEvaluator: "evaluate_configuration_management",
    },
  },

  {
    controlId: "PR.PS-02",
    title: "Software Integrity and Patch Management",
    description: "Software is maintained to reduce known vulnerabilities through patching and updates.",
    frameworkId: FRAMEWORK,
    family: "Protect: Platform Security",
    evidenceQueries: [
      {
        id: "pr-ps-02-update-compliance",
        description: "Device compliance policies requiring current OS versions",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "pr-ps-02-noncompliant-devices",
        description: "Non-compliant devices (potentially unpatched)",
        endpoint: "/deviceManagement/managedDevices",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
        topN: 10,
        selectFields: ["id", "deviceName", "complianceState", "osVersion", "operatingSystem"],
        filterExpression: "complianceState eq 'noncompliant'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Patch compliance policies are active and device OS compliance is enforced",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "PR.PS-04",
    title: "Logs and Audit Trails",
    description: "Logs of events are created, protected, and maintained.",
    frameworkId: FRAMEWORK,
    family: "Protect: Platform Security",
    evidenceQueries: [
      {
        id: "pr-ps-04-sign-in-logs",
        description: "Sign-in audit logs being generated",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 5,
        selectFields: ["userPrincipalName", "appDisplayName", "createdDateTime", "status"],
      },
      {
        id: "pr-ps-04-directory-audits",
        description: "Directory audit logs being generated",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 5,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Both sign-in and directory audit logs are actively capturing events",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "PR.PS-05",
    title: "Privileged Access Hardening",
    description: "Installation and execution of unauthorized software is prevented; privileged access is controlled.",
    frameworkId: FRAMEWORK,
    family: "Protect: Platform Security",
    evidenceQueries: [
      {
        id: "pr-ps-05-pim-role-assignments",
        description: "Privileged Identity Management (PIM) eligible role assignments",
        endpoint: "/roleManagement/directory/roleEligibilitySchedules",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 10,
        selectFields: ["id", "principalId", "roleDefinitionId", "scheduleInfo"],
      },
      {
        id: "pr-ps-05-active-assignments",
        description: "Active directory role assignments to verify minimized standing access",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "PIM is in use for eligible roles, reducing standing privileged access",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "PR.IR-01",
    title: "Business Continuity and Resilience Planning",
    description: "Networks and environments are protected to support resilience against cybersecurity attacks.",
    frameworkId: FRAMEWORK,
    family: "Protect: Technology Infrastructure Resilience",
    evidenceQueries: [
      {
        id: "pr-ir-01-ca-policies",
        description: "Conditional Access policies protecting authentication resilience",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "pr-ir-01-device-compliance",
        description: "Device compliance policies for managed endpoint resilience",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Conditional Access and device compliance protect access resilience",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  // ===========================================================================
  // DE — DETECT
  // Find and analyze potential cybersecurity attacks and compromises
  // ===========================================================================

  {
    controlId: "DE.CM-01",
    title: "Networks and User Activity Monitoring",
    description: "Networks, network services, and user activity are monitored to find potentially adverse events.",
    frameworkId: FRAMEWORK,
    family: "Detect: Continuous Monitoring",
    evidenceQueries: [
      {
        id: "de-cm-01-sign-in-logs",
        description: "Sign-in audit log activity",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["userPrincipalName", "appDisplayName", "ipAddress", "createdDateTime", "status", "riskLevelDuringSignIn"],
      },
      {
        id: "de-cm-01-security-alerts",
        description: "Active security alerts",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Sign-in activity is being logged and security alerts are generated",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "DE.CM-03",
    title: "Computing Hardware and Software Monitoring",
    description: "Computing hardware, software, runtime environments, and their data are monitored.",
    frameworkId: FRAMEWORK,
    family: "Detect: Continuous Monitoring",
    evidenceQueries: [
      {
        id: "de-cm-03-directory-audits",
        description: "Directory audit logs for system-level changes",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
      {
        id: "de-cm-03-secure-score",
        description: "Microsoft Secure Score for ongoing posture monitoring",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Directory audit logging is active and Secure Score is being tracked",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "DE.CM-06",
    title: "Service Provider Activity Monitoring",
    description: "External service provider activities and services are monitored for anomalies.",
    frameworkId: FRAMEWORK,
    family: "Detect: Continuous Monitoring",
    evidenceQueries: [
      {
        id: "de-cm-06-service-principals",
        description: "Service principal sign-in activity",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["appId", "appDisplayName", "ipAddress", "createdDateTime", "status", "servicePrincipalName"],
      },
      {
        id: "de-cm-06-sp-audit",
        description: "Service principal and application audit events",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'ApplicationManagement'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Service principal sign-in and application audit logs are active",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "DE.CM-09",
    title: "Computing Capabilities Monitoring",
    description: "The organization's computing capabilities and the integrity of related systems are monitored.",
    frameworkId: FRAMEWORK,
    family: "Detect: Continuous Monitoring",
    evidenceQueries: [
      {
        id: "de-cm-09-alerts",
        description: "Security alerts from Microsoft 365 Defender",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category", "providerAlertId"],
      },
      {
        id: "de-cm-09-risky-sign-ins",
        description: "Risky sign-in events for computing anomaly detection",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskEventType", "riskLevel", "riskState", "detectedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security alerts and identity risk detections are actively monitored",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "DE.AE-02",
    title: "Adverse Event Analysis",
    description: "Potentially adverse events are analyzed to characterize them and detect cybersecurity incidents.",
    frameworkId: FRAMEWORK,
    family: "Detect: Adverse Event Analysis",
    evidenceQueries: [
      {
        id: "de-ae-02-security-alerts",
        description: "Security alerts requiring analysis",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category", "description"],
      },
      {
        id: "de-ae-02-risk-detections",
        description: "Identity risk detections requiring investigation",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskEventType", "riskLevel", "riskState", "detectedDateTime", "ipAddress"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security alerts and identity risk detections are being generated and available for analysis",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "DE.AE-04",
    title: "Event Impact Estimation",
    description: "The estimated impact and scope of adverse events are understood.",
    frameworkId: FRAMEWORK,
    family: "Detect: Adverse Event Analysis",
    evidenceQueries: [
      {
        id: "de-ae-04-high-severity-alerts",
        description: "High and medium severity security alerts for impact assessment",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category", "description", "assignedTo"],
      },
      {
        id: "de-ae-04-risky-users-high",
        description: "High-risk users indicating potential high-impact incidents",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "userPrincipalName", "riskLevel", "riskState", "riskLastUpdatedDateTime"],
        filterExpression: "riskLevel eq 'high'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "High-severity alerts and high-risk user accounts are identified for impact assessment",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  // ===========================================================================
  // RS — RESPOND
  // Take action regarding a detected cybersecurity incident
  // ===========================================================================

  {
    controlId: "RS.MA-01",
    title: "Incident Response Execution",
    description: "The incident response plan is executed in coordination with relevant third parties once an incident is declared.",
    frameworkId: FRAMEWORK,
    family: "Respond: Incident Management",
    evidenceQueries: [
      {
        id: "rs-ma-01-security-alerts",
        description: "Security alerts (active incidents requiring response)",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category", "assignedTo", "resolvedDateTime"],
      },
      {
        id: "rs-ma-01-risky-users",
        description: "Risky user accounts requiring response actions",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "userPrincipalName", "riskLevel", "riskState", "riskLastUpdatedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security incident and risky user workflows are active and being managed",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "RS.MA-02",
    title: "Incident Reporting",
    description: "Incidents are reported to designated internal and external stakeholders in a timely manner.",
    frameworkId: FRAMEWORK,
    family: "Respond: Incident Management",
    evidenceQueries: [
      {
        id: "rs-ma-02-security-contacts",
        description: "Organization security notification contacts configured",
        endpoint: "/organization",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Organization.Read.All"],
        selectFields: ["id", "securityComplianceNotificationPhones", "securityComplianceNotificationMails", "technicalNotificationMails"],
      },
      {
        id: "rs-ma-02-resolved-alerts",
        description: "Resolved alerts showing incident lifecycle completion",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
        selectFields: ["id", "title", "status", "resolvedDateTime", "assignedTo"],
        filterExpression: "status eq 'resolved'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security notification contacts are configured and resolved alerts demonstrate incident tracking",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "RS.AN-03",
    title: "Incident Root Cause Analysis",
    description: "Root causes of incidents are analyzed to determine contributing factors and inform improvements.",
    frameworkId: FRAMEWORK,
    family: "Respond: Incident Analysis",
    evidenceQueries: [
      {
        id: "rs-an-03-risk-detections",
        description: "Detailed risk detection events for root cause analysis",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskEventType", "riskLevel", "riskState", "detectedDateTime", "ipAddress", "location", "additionalInfo"],
      },
      {
        id: "rs-an-03-audit-logs",
        description: "Directory audit logs supporting root cause investigation",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy", "targetResources"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Risk detection details and audit logs provide root cause investigation capability",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "RS.CO-01",
    title: "Incident Response Communications",
    description: "Response activities are coordinated with stakeholders via appropriate communication channels.",
    frameworkId: FRAMEWORK,
    family: "Respond: Incident Response Reporting and Communication",
    evidenceQueries: [
      {
        id: "rs-co-01-org-contacts",
        description: "Security and compliance notification contacts",
        endpoint: "/organization",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Organization.Read.All"],
        selectFields: ["id", "securityComplianceNotificationMails", "technicalNotificationMails"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Organizational security and technical notification contacts are defined",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "RS.MI-01",
    title: "Incident Containment",
    description: "Incidents are contained to minimize their impact.",
    frameworkId: FRAMEWORK,
    family: "Respond: Incident Mitigation",
    evidenceQueries: [
      {
        id: "rs-mi-01-dismissed-risky-users",
        description: "Risky users whose risk has been remediated or dismissed",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "userPrincipalName", "riskLevel", "riskState", "riskLastUpdatedDateTime"],
        filterExpression: "riskState eq 'remediated' or riskState eq 'dismissed'",
      },
      {
        id: "rs-mi-01-ca-risk-policies",
        description: "Conditional Access policies with risk-based conditions for automated containment",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Risk-based Conditional Access policies provide automated containment and risky users are being remediated",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  // ===========================================================================
  // RC — RECOVER
  // Restore capabilities or services impaired by a cybersecurity incident
  // ===========================================================================

  {
    controlId: "RC.RP-01",
    title: "Recovery Plan Execution",
    description: "The recovery portion of the incident response plan is executed once initiated.",
    frameworkId: FRAMEWORK,
    family: "Recover: Incident Recovery Plan Execution",
    evidenceQueries: [
      {
        id: "rc-rp-01-org-resilience",
        description: "Organization tenant configuration showing recovery readiness",
        endpoint: "/organization",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Organization.Read.All"],
        selectFields: ["id", "displayName", "onPremisesSyncEnabled", "securityComplianceNotificationMails"],
      },
      {
        id: "rc-rp-01-ca-policies",
        description: "Conditional Access policies that can be disabled/enabled for incident response",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Organization and access policies are configured to support recovery operations",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  {
    controlId: "RC.RP-03",
    title: "Recovery Integrity Verification",
    description: "The integrity of backups and other restoration assets are verified before use.",
    frameworkId: FRAMEWORK,
    family: "Recover: Incident Recovery Plan Execution",
    evidenceQueries: [
      {
        id: "rc-rp-03-device-compliance",
        description: "Device compliance checks ensuring device integrity before recovery access",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "rc-rp-03-audit-logs",
        description: "Audit log integrity — logs being maintained for recovery reference",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 5,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Compliance policies and audit logs support recovery integrity validation",
      customEvaluator: "evaluate_configuration_management",
    },
  },

  {
    controlId: "RC.RP-05",
    title: "Recovery Operations Completeness",
    description: "The completeness of recovery operations is verified and documented.",
    frameworkId: FRAMEWORK,
    family: "Recover: Incident Recovery Plan Execution",
    evidenceQueries: [
      {
        id: "rc-rp-05-resolved-alerts",
        description: "Fully resolved security alerts demonstrating incident closure",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 10,
        selectFields: ["id", "title", "severity", "status", "resolvedDateTime", "assignedTo"],
        filterExpression: "status eq 'resolved'",
      },
      {
        id: "rc-rp-05-risk-remediated",
        description: "Risk detections marked as remediated — confirming recovery actions completed",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskEventType", "riskState", "detectedDateTime"],
        filterExpression: "riskState eq 'remediated'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Resolved alerts and remediated risk events demonstrate completed recovery operations",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "RC.CO-03",
    title: "Recovery Communications",
    description: "Recovery activities and progress are communicated to internal and external stakeholders.",
    frameworkId: FRAMEWORK,
    family: "Recover: Incident Recovery Communication",
    evidenceQueries: [
      {
        id: "rc-co-03-security-contacts",
        description: "Security notification contacts for recovery communications",
        endpoint: "/organization",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Organization.Read.All"],
        selectFields: ["id", "securityComplianceNotificationMails", "securityComplianceNotificationPhones", "technicalNotificationMails"],
      },
      {
        id: "rc-co-03-audit-trail",
        description: "Post-incident audit trail showing recovery activities",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 5,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Recovery communication contacts are defined and audit trail supports reporting",
      customEvaluator: "evaluate_evidence_exists",
    },
  },
];
