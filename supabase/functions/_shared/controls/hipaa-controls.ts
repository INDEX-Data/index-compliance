// =============================================================================
// INDEX DSaaS — HIPAA Security Rule Controls
//
// 45 CFR Part 164, Subpart C — Security Standards for the Protection of
// Electronic Protected Health Information (ePHI)
//
// Organized by the three safeguard categories:
//   § 164.308  Administrative Safeguards (12 controls)
//   § 164.310  Physical Safeguards      (4 controls)
//   § 164.312  Technical Safeguards     (5 controls)
//   § 164.314  Organizational Requirements (1 control)
//
// All evidence collected via Microsoft Graph API (M365 / Azure AD / Intune).
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.ts";

const FW: FrameworkId = "HIPAA";

export const hipaaControls: ComplianceControl[] = [

  // ===========================================================================
  // ADMINISTRATIVE SAFEGUARDS — § 164.308
  // ===========================================================================

  {
    controlId: "164.308(a)(1)(i)",
    title: "Risk Analysis",
    description: "Conduct an accurate and thorough assessment of potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic protected health information (ePHI).",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a1i-score",
        description: "Microsoft Secure Score — overall security posture and risk indicators",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "hipaa-308a1i-profiles",
        description: "Secure Score improvement actions (control profiles)",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
      },
      {
        id: "hipaa-308a1i-riskdetect",
        description: "Identity risk detections (threats to ePHI access)",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 20,
        selectFields: ["id", "riskType", "riskLevel", "riskState", "detectedDateTime", "userDisplayName"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Active risk monitoring (Secure Score) in place with no unaddressed high/critical identity risks",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  {
    controlId: "164.308(a)(1)(ii)(B)",
    title: "Risk Management",
    description: "Implement security measures sufficient to reduce risks and vulnerabilities to ePHI to a reasonable and appropriate level.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a1iib-ca",
        description: "Conditional Access policies enforcing access controls for ePHI systems",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "hipaa-308a1iib-compliance",
        description: "Device compliance policies ensuring endpoints meet security baseline",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-308a1iib-riskyusers",
        description: "Risky users requiring remediation",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskyUser.Read.All"],
        topN: 10,
        selectFields: ["id", "userDisplayName", "riskLevel", "riskState", "riskLastUpdatedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Risk mitigation controls (CA policies, device compliance, identity risk remediation) are active",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  {
    controlId: "164.308(a)(2)",
    title: "Assigned Security Responsibility",
    description: "Identify the security official who is responsible for the development and implementation of the policies and procedures required by the HIPAA Security Rule.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a2-roles",
        description: "Directory role assignments — identify Security Admin / Compliance Admin roles",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "hipaa-308a2-roledefs",
        description: "Role definitions to verify security-specific roles exist",
        endpoint: "/roleManagement/directory/roleDefinitions",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 30,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Dedicated Security Admin or Compliance Admin role assignments exist and are not overly broad",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "164.308(a)(3)(ii)(A)",
    title: "Authorization and Supervision",
    description: "Implement procedures for the authorization and supervision of workforce members who work with ePHI or in locations where it might be accessed.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a3iia-roles",
        description: "Role assignments showing workforce access authorization levels",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "hipaa-308a3iia-ca",
        description: "Conditional Access policies gating access to regulated applications",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Role-based access controls limit ePHI access to authorized workforce members",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "164.308(a)(3)(ii)(C)",
    title: "Termination Procedures",
    description: "Implement procedures for terminating access to ePHI when the employment or workforce arrangement ends.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a3iic-ca",
        description: "Conditional Access policies blocking disabled or non-compliant accounts",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "hipaa-308a3iic-audit",
        description: "Audit logs for user account lifecycle events (disable, delete)",
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
      passingCondition: "User lifecycle events are audited; terminated user access is revoked promptly",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "164.308(a)(4)(ii)(B)",
    title: "Access Authorization",
    description: "Implement policies and procedures for granting access to ePHI — for example, through access to a workstation, transaction, program, or process.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a4iib-ca",
        description: "Conditional Access policies enforcing access requirements",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "hipaa-308a4iib-roles",
        description: "Role assignments for access grant management",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "hipaa-308a4iib-mfa",
        description: "MFA registration details for workforce accounts",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Formal access control policies (CA + RBAC) govern who can access ePHI-bearing systems",
      customEvaluator: "evaluate_mfa_enforcement",
    },
  },

  {
    controlId: "164.308(a)(5)(ii)(B)",
    title: "Protection from Malicious Software",
    description: "Procedures for guarding against, detecting, and reporting malicious software.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a5iib-compliance",
        description: "Device compliance policies enforcing antivirus and threat protection",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-308a5iib-alerts",
        description: "Security alerts from Defender for malware/threat detections",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category"],
        apiVersion: "v1",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance policies require anti-malware; Defender alerting is active",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "164.308(a)(5)(ii)(C)",
    title: "Log-in Monitoring",
    description: "Procedures for monitoring log-in attempts and reporting discrepancies.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a5iic-signin",
        description: "Sign-in logs to verify authentication monitoring is active",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["userPrincipalName", "createdDateTime", "status", "ipAddress", "riskLevelDuringSignIn"],
        filterExpression: "status/errorCode ne 0",
      },
      {
        id: "hipaa-308a5iic-riskdetect",
        description: "Identity risk detections for anomalous sign-in behavior",
        endpoint: "/identityProtection/riskDetections",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskEvent.Read.All"],
        topN: 10,
        selectFields: ["id", "riskType", "riskLevel", "riskState", "detectedDateTime"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Sign-in activity and risk events are monitored via Entra ID sign-in logs and Identity Protection",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "164.308(a)(5)(ii)(D)",
    title: "Password Management",
    description: "Procedures for creating, changing, and safeguarding passwords.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a5iid-mfa",
        description: "MFA registration — strong authentication replacing weak passwords",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
      {
        id: "hipaa-308a5iid-authpolicy",
        description: "Authorization policy — password protection and banned passwords settings",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "MFA is registered by all workforce members; password protection policies are in place",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "164.308(a)(6)(i)",
    title: "Security Incident Procedures",
    description: "Implement policies and procedures to address security incidents, including identifying and responding to suspected or known security incidents.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a6i-alerts",
        description: "Security alerts — active incidents requiring response",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category"],
        apiVersion: "v1",
      },
      {
        id: "hipaa-308a6i-riskyusers",
        description: "Risky users — identity incidents requiring remediation",
        endpoint: "/identityProtection/riskyUsers",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["IdentityRiskyUser.Read.All"],
        topN: 10,
        selectFields: ["id", "userDisplayName", "riskLevel", "riskState"],
      },
      {
        id: "hipaa-308a6i-signin",
        description: "Recent sign-in activity for incident correlation",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["userPrincipalName", "createdDateTime", "status", "ipAddress"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Security alerting is active; open incidents are triaged; risky users are remediated",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "164.308(a)(7)(ii)(A)",
    title: "Data Backup Plan",
    description: "Establish and implement procedures to create and maintain retrievable exact copies of ePHI.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a7iia-retention",
        description: "Retention policies configured for M365 data preservation",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "hipaa-308a7iia-audit",
        description: "Audit log activity for data management operations",
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
      passingCondition: "M365 retention policies or equivalent backup mechanisms preserve ePHI copies",
      customEvaluator: "evaluate_evidence_exists",
    },
  },

  {
    controlId: "164.308(a)(8)",
    title: "Evaluation",
    description: "Perform a periodic technical and nontechnical evaluation in response to environmental or operations changes affecting ePHI security.",
    frameworkId: FW,
    family: "Administrative Safeguards — § 164.308",
    evidenceQueries: [
      {
        id: "hipaa-308a8-score",
        description: "Secure Score — continuous security evaluation posture",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 5,
      },
      {
        id: "hipaa-308a8-profiles",
        description: "Secure Score control improvement actions — gaps to evaluate",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 30,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Ongoing security evaluation is supported by Secure Score tracking and control gap analysis",
      customEvaluator: "evaluate_risk_assessment",
    },
  },

  // ===========================================================================
  // PHYSICAL SAFEGUARDS — § 164.310
  // ===========================================================================

  {
    controlId: "164.310(a)(1)",
    title: "Facility Access Controls",
    description: "Implement policies and procedures to limit physical access to electronic information systems and the facilities in which they are housed, while ensuring that properly authorized access is allowed.",
    frameworkId: FW,
    family: "Physical Safeguards — § 164.310",
    evidenceQueries: [
      {
        id: "hipaa-310a1-devicecompliance",
        description: "Device compliance policies — physical device access requirements",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-310a1-ca",
        description: "Conditional Access policies requiring compliant or hybrid-joined devices",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance policies and CA controls ensure only authorized endpoints access ePHI systems",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "164.310(b)",
    title: "Workstation Use",
    description: "Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation that can access ePHI.",
    frameworkId: FW,
    family: "Physical Safeguards — § 164.310",
    evidenceQueries: [
      {
        id: "hipaa-310b-config",
        description: "Device configuration profiles controlling workstation use settings",
        endpoint: "/deviceManagement/deviceConfigurations",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-310b-compliance",
        description: "Device compliance policies enforcing workstation security requirements",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Intune configuration profiles define and enforce proper workstation use policies",
      customEvaluator: "evaluate_configuration_management",
    },
  },

  {
    controlId: "164.310(c)",
    title: "Workstation Security",
    description: "Implement physical safeguards for all workstations that access ePHI to restrict access to authorized users.",
    frameworkId: FW,
    family: "Physical Safeguards — § 164.310",
    evidenceQueries: [
      {
        id: "hipaa-310c-compliance",
        description: "Device compliance policies requiring encryption, screen lock, and passcode",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-310c-ca",
        description: "CA policies requiring compliant devices to access corporate resources",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Workstations are managed by Intune with encryption and screen-lock policies enforced",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  {
    controlId: "164.310(d)(1)",
    title: "Device and Media Controls",
    description: "Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI.",
    frameworkId: FW,
    family: "Physical Safeguards — § 164.310",
    evidenceQueries: [
      {
        id: "hipaa-310d1-config",
        description: "Device configuration profiles controlling removable media and USB access",
        endpoint: "/deviceManagement/deviceConfigurations",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "hipaa-310d1-dlp",
        description: "Audit activity for information protection and DLP events",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device configurations restrict removable media; DLP policies prevent unauthorized ePHI export",
      customEvaluator: "evaluate_configuration_management",
    },
  },

  // ===========================================================================
  // TECHNICAL SAFEGUARDS — § 164.312
  // ===========================================================================

  {
    controlId: "164.312(a)(1)",
    title: "Access Control",
    description: "Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.",
    frameworkId: FW,
    family: "Technical Safeguards — § 164.312",
    evidenceQueries: [
      {
        id: "hipaa-312a1-ca",
        description: "Conditional Access policies restricting ePHI system access",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "hipaa-312a1-mfa",
        description: "MFA registration for all users accessing ePHI",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
      {
        id: "hipaa-312a1-roles",
        description: "Role-based access assignments for ePHI systems",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "CA policies + MFA + RBAC restrict access to ePHI systems to authorized personnel only",
      customEvaluator: "evaluate_mfa_enforcement",
    },
  },

  {
    controlId: "164.312(b)",
    title: "Audit Controls",
    description: "Implement hardware, software, and procedural mechanisms that record and examine activity in information systems that contain or use ePHI.",
    frameworkId: FW,
    family: "Technical Safeguards — § 164.312",
    evidenceQueries: [
      {
        id: "hipaa-312b-auditdir",
        description: "Directory audit logs — user and admin activity on ePHI systems",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
      {
        id: "hipaa-312b-signins",
        description: "Sign-in logs — access to ePHI systems",
        endpoint: "/auditLogs/signIns",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["userPrincipalName", "createdDateTime", "status", "appDisplayName", "ipAddress"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Unified audit logging captures user activity, sign-ins, and admin operations across ePHI systems",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "164.312(c)(1)",
    title: "Integrity Controls",
    description: "Implement policies and procedures to protect ePHI from improper alteration or destruction.",
    frameworkId: FW,
    family: "Technical Safeguards — § 164.312",
    evidenceQueries: [
      {
        id: "hipaa-312c1-labels",
        description: "Audit activity for sensitivity label and information protection events",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "hipaa-312c1-score",
        description: "Secure Score — data integrity control signals",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Information protection policies (sensitivity labels, DLP) prevent unauthorized modification of ePHI",
      customEvaluator: "evaluate_sensitivity_labels",
    },
  },

  {
    controlId: "164.312(d)",
    title: "Person or Entity Authentication",
    description: "Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.",
    frameworkId: FW,
    family: "Technical Safeguards — § 164.312",
    evidenceQueries: [
      {
        id: "hipaa-312d-mfa",
        description: "MFA registration rates across all workforce accounts",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
      {
        id: "hipaa-312d-ca-mfa",
        description: "Conditional Access policies enforcing MFA at sign-in",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "MFA is enforced for all users accessing ePHI via Conditional Access and authentication policies",
      customEvaluator: "evaluate_mfa_coverage",
    },
  },

  {
    controlId: "164.312(e)(1)",
    title: "Transmission Security",
    description: "Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.",
    frameworkId: FW,
    family: "Technical Safeguards — § 164.312",
    evidenceQueries: [
      {
        id: "hipaa-312e1-ca-device",
        description: "CA policies requiring compliant/managed devices (enforces secure transmission paths)",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "hipaa-312e1-score",
        description: "Secure Score — TLS / encryption-at-rest and in-transit signals",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "hipaa-312e1-dlp",
        description: "DLP audit events — protecting ePHI from unauthorized transmission",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 10,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Conditional Access enforces compliant device access; DLP guards against unauthorized ePHI transmission",
      customEvaluator: "evaluate_dlp_policies",
    },
  },

  // ===========================================================================
  // ORGANIZATIONAL REQUIREMENTS — § 164.314
  // ===========================================================================

  {
    controlId: "164.314(a)(1)",
    title: "Business Associate Contracts",
    description: "A covered entity may not permit a business associate to create, receive, maintain, or transmit ePHI on its behalf without entering into a satisfactory business associate contract.",
    frameworkId: FW,
    family: "Organizational Requirements — § 164.314",
    evidenceQueries: [
      {
        id: "hipaa-314a1-guests",
        description: "External/guest user accounts (potential business associates with tenant access)",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 50,
        selectFields: ["id", "displayName", "userPrincipalName", "userType", "externalUserState", "createdDateTime"],
        filterExpression: "userType eq 'Guest'",
      },
      {
        id: "hipaa-314a1-policy",
        description: "External collaboration / guest invitation policy settings",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "External access is restricted; guest accounts are limited and governed by restrictive invitation policy",
      customEvaluator: "evaluate_guest_access",
    },
  },
];
