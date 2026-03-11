// =============================================================================
// INDEX DSaaS — FERPA Cybersecurity Controls
//
// Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. § 1232g;
// 34 CFR Part 99. FERPA protects the privacy of student education records
// and grants students and parents rights to access, review, and correct them.
//
// FERPA does not specify technical controls in the way HIPAA/CMMC do.
// This mapping derives technical controls from the FERPA statutory intent:
//   - Protect student PII / education records from unauthorized access
//   - Control who can access records and under what conditions
//   - Maintain disclosure logs when records are shared with third parties
//   - Respond to breaches and notify affected students/parents
//
// Mapped to Microsoft 365 / Azure AD / Intune controls that cover the
// technical safeguarding obligations expected of educational institutions.
//
// Organized by five operational control areas:
//   1. Identity & Access Management
//   2. Data Protection & Privacy
//   3. Audit & Accountability
//   4. Third-Party & Directory Controls
//   5. Incident Response & Breach Notification
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";

const FW: FrameworkId = "FERPA";

export const ferpaControls: ComplianceControl[] = [

  // ===========================================================================
  // AREA 1 — IDENTITY & ACCESS MANAGEMENT
  // ===========================================================================

  {
    controlId: "FERPA-IAM-1",
    title: "Authorized Access to Education Records",
    description: "Limit access to student education records to school officials with a legitimate educational interest. Systems containing student PII must use role-based access controls.",
    frameworkId: FW,
    family: "Identity & Access Management",
    evidenceQueries: [
      {
        id: "ferpa-iam1-roles",
        description: "Directory role assignments restricting access to authorized personnel",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "ferpa-iam1-ca",
        description: "Conditional Access policies controlling access to student data systems",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "RBAC and Conditional Access restrict student record access to authorized school officials",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "FERPA-IAM-2",
    title: "Strong Authentication for Staff",
    description: "Require strong authentication (including MFA) for all staff and administrators with access to student education records. Weak authentication increases risk of unauthorized disclosure.",
    frameworkId: FW,
    family: "Identity & Access Management",
    evidenceQueries: [
      {
        id: "ferpa-iam2-ca",
        description: "Conditional Access policies requiring MFA for staff accessing student systems",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "ferpa-iam2-mfa",
        description: "MFA registration status for staff user accounts",
        endpoint: "/reports/authenticationMethods/userRegistrationDetails",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["UserAuthenticationMethod.Read.All"],
        topN: 100,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "MFA is enforced for all staff accounts; high MFA registration confirms strong authentication adoption",
      customEvaluator: "evaluate_mfa_enforcement",
    },
  },

  {
    controlId: "FERPA-IAM-3",
    title: "Privilege Management and Least Privilege",
    description: "Apply the principle of least privilege to all systems containing student records. Administrative access should be minimized and reviewed periodically.",
    frameworkId: FW,
    family: "Identity & Access Management",
    evidenceQueries: [
      {
        id: "ferpa-iam3-roles",
        description: "Privileged role assignments — scope of administrative access",
        endpoint: "/roleManagement/directory/roleAssignments",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
      },
      {
        id: "ferpa-iam3-roledefs",
        description: "Role definitions — breadth of permissions assigned",
        endpoint: "/roleManagement/directory/roleDefinitions",
        method: "GET",
        category: "roleAssignments",
        requiredPermissions: ["RoleManagement.Read.Directory"],
        topN: 20,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Administrative access to student record systems is minimal and role-scoped; Global Admin count is controlled",
      customEvaluator: "evaluate_rbac",
    },
  },

  {
    controlId: "FERPA-IAM-4",
    title: "Account Lifecycle Management",
    description: "Promptly disable or remove access for staff who leave the institution or no longer require access to student records. Stale accounts represent unauthorized access risk.",
    frameworkId: FW,
    family: "Identity & Access Management",
    evidenceQueries: [
      {
        id: "ferpa-iam4-audit",
        description: "User account lifecycle audit events — account disable and deletion activity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'UserManagement'",
      },
      {
        id: "ferpa-iam4-ca",
        description: "Conditional Access policies blocking disabled/non-compliant accounts",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "User lifecycle events (disable, delete) are audited; CA policies enforce blocks on inactive accounts",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  // ===========================================================================
  // AREA 2 — DATA PROTECTION & PRIVACY
  // ===========================================================================

  {
    controlId: "FERPA-DAT-1",
    title: "Student Data Classification and Labeling",
    description: "Classify and label student education records and PII to ensure appropriate handling. Sensitivity labels help ensure student data receives the correct level of protection.",
    frameworkId: FW,
    family: "Data Protection & Privacy",
    evidenceQueries: [
      {
        id: "ferpa-dat1-labels",
        description: "Sensitivity label and information protection policy audit activity",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "ferpa-dat1-score",
        description: "Secure Score — data classification control signals",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Sensitivity labels classify student education records and trigger appropriate protection controls",
      customEvaluator: "evaluate_sensitivity_labels",
    },
  },

  {
    controlId: "FERPA-DAT-2",
    title: "DLP — Prevent Unauthorized Student Record Disclosure",
    description: "Implement data loss prevention policies to prevent unauthorized sharing of student education records, grades, transcripts, and other FERPA-protected information.",
    frameworkId: FW,
    family: "Data Protection & Privacy",
    evidenceQueries: [
      {
        id: "ferpa-dat2-dlp",
        description: "DLP policy enforcement activity for student data protection",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 20,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result"],
        filterExpression: "category eq 'InformationProtectionPolicy'",
      },
      {
        id: "ferpa-dat2-score",
        description: "Secure Score — DLP posture for student data",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "DLP policies protect student PII from unauthorized email, cloud storage, or external sharing",
      customEvaluator: "evaluate_dlp_policies",
    },
  },

  {
    controlId: "FERPA-DAT-3",
    title: "Encryption of Student Records",
    description: "Encrypt student education records at rest and in transit. Devices used to access student data must use full-disk encryption to protect against physical data loss.",
    frameworkId: FW,
    family: "Data Protection & Privacy",
    evidenceQueries: [
      {
        id: "ferpa-dat3-devicecompliance",
        description: "Device compliance policies requiring encryption for devices with student data",
        endpoint: "/deviceManagement/deviceCompliancePolicies",
        method: "GET",
        category: "deviceCompliance",
        requiredPermissions: ["DeviceManagementConfiguration.Read.All"],
      },
      {
        id: "ferpa-dat3-ca",
        description: "CA policies requiring compliant (encrypted) devices to access student systems",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Device compliance requires encryption; CA blocks unencrypted devices from student record access",
      customEvaluator: "evaluate_device_compliance",
    },
  },

  // ===========================================================================
  // AREA 3 — AUDIT & ACCOUNTABILITY
  // ===========================================================================

  {
    controlId: "FERPA-AUD-1",
    title: "Audit Logging of Student Record Access",
    description: "Maintain logs of access to systems containing student education records. FERPA requires institutions to maintain a record of disclosures of student education records.",
    frameworkId: FW,
    family: "Audit & Accountability",
    evidenceQueries: [
      {
        id: "ferpa-aud1-auditlog",
        description: "Directory audit logs — access to student record systems",
        endpoint: "/auditLogs/directoryAudits",
        method: "GET",
        category: "auditLog",
        requiredPermissions: ["AuditLog.Read.All"],
        topN: 30,
        selectFields: ["id", "category", "activityDisplayName", "activityDateTime", "result", "initiatedBy"],
      },
      {
        id: "ferpa-aud1-signin",
        description: "Sign-in logs — user authentication to student data systems",
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
      passingCondition: "Unified audit logging is active and records access to student data systems for compliance review",
      customEvaluator: "evaluate_audit_logging",
    },
  },

  {
    controlId: "FERPA-AUD-2",
    title: "Security Monitoring and Anomaly Detection",
    description: "Monitor systems containing student records for unauthorized access attempts and anomalous behavior. Alert on suspicious activity that may indicate an unauthorized disclosure.",
    frameworkId: FW,
    family: "Audit & Accountability",
    evidenceQueries: [
      {
        id: "ferpa-aud2-alerts",
        description: "Security alerts — unauthorized access attempts to student systems",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "severity", "status", "createdDateTime", "category"],
        apiVersion: "v1",
      },
      {
        id: "ferpa-aud2-riskdetect",
        description: "Identity risk detections — anomalous access patterns",
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
      passingCondition: "Security monitoring detects anomalous access to student systems; alerts are actively triaged",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  // ===========================================================================
  // AREA 4 — THIRD-PARTY & DIRECTORY CONTROLS
  // ===========================================================================

  {
    controlId: "FERPA-3P-1",
    title: "Third-Party Service Provider Controls (School Official Exception)",
    description: "When disclosing student records to contractors or third-party service providers under the 'school official' exception, ensure they have a legitimate educational interest and are governed by written agreements.",
    frameworkId: FW,
    family: "Third-Party & Directory Controls",
    evidenceQueries: [
      {
        id: "ferpa-3p1-apps",
        description: "Enterprise applications — third-party services with access to student data",
        endpoint: "/applications",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["Application.Read.All"],
        topN: 30,
        selectFields: ["id", "displayName", "signInAudience", "createdDateTime"],
      },
      {
        id: "ferpa-3p1-guests",
        description: "Guest user accounts — external parties with student system access",
        endpoint: "/users",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["User.Read.All"],
        topN: 50,
        selectFields: ["id", "displayName", "userPrincipalName", "userType", "externalUserState", "createdDateTime"],
        filterExpression: "userType eq 'Guest'",
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Third-party applications are inventoried; external guest access to student systems is controlled and minimal",
      customEvaluator: "evaluate_guest_access",
    },
  },

  {
    controlId: "FERPA-3P-2",
    title: "Student-Facing Directory Information Controls",
    description: "Control access to directory information and provide mechanisms for students/parents to opt out of directory disclosures. System settings must support FERPA directory opt-out requirements.",
    frameworkId: FW,
    family: "Third-Party & Directory Controls",
    evidenceQueries: [
      {
        id: "ferpa-3p2-authpolicy",
        description: "Authorization policy — external sharing and collaboration settings",
        endpoint: "/policies/authorizationPolicy",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
      {
        id: "ferpa-3p2-ca",
        description: "Conditional Access policies controlling access to directory information",
        endpoint: "/identity/conditionalAccess/policies",
        method: "GET",
        category: "conditionalAccess",
        requiredPermissions: ["Policy.Read.All"],
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Tenant authorization policies restrict external sharing of directory information; CA policies gate access",
      customEvaluator: "evaluate_policy_exists",
    },
  },

  // ===========================================================================
  // AREA 5 — INCIDENT RESPONSE & BREACH NOTIFICATION
  // ===========================================================================

  {
    controlId: "FERPA-IR-1",
    title: "Incident Response for FERPA Breaches",
    description: "Implement incident response procedures for unauthorized disclosures of student education records. Institutions must be able to identify, contain, and document unauthorized access incidents.",
    frameworkId: FW,
    family: "Incident Response & Breach Notification",
    evidenceQueries: [
      {
        id: "ferpa-ir1-alerts",
        description: "Security alerts — detection capability for unauthorized record access",
        endpoint: "/security/alerts_v2",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
        selectFields: ["id", "title", "severity", "status", "createdDateTime"],
        apiVersion: "v1",
      },
      {
        id: "ferpa-ir1-riskyusers",
        description: "Risky users — compromised accounts that may have accessed student records",
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
      passingCondition: "Security incident detection is active; risky user remediation reduces unauthorized record access risk",
      customEvaluator: "evaluate_security_monitoring",
    },
  },

  {
    controlId: "FERPA-IR-2",
    title: "Risk Assessment and Security Evaluation",
    description: "Conduct periodic security assessments of systems containing student records. Risk assessments should identify gaps in technical controls that could lead to unauthorized disclosures.",
    frameworkId: FW,
    family: "Incident Response & Breach Notification",
    evidenceQueries: [
      {
        id: "ferpa-ir2-score",
        description: "Microsoft Secure Score — security posture assessment for student record systems",
        endpoint: "/security/secureScores",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 1,
      },
      {
        id: "ferpa-ir2-profiles",
        description: "Secure Score improvement actions — identified security gaps",
        endpoint: "/security/secureScoreControlProfiles",
        method: "GET",
        category: "identityProtection",
        requiredPermissions: ["SecurityEvents.Read.All"],
        topN: 20,
      },
    ],
    evaluationCriteria: {
      type: "custom",
      passingCondition: "Ongoing security evaluation via Secure Score identifies and tracks controls needed to protect student records",
      customEvaluator: "evaluate_risk_assessment",
    },
  },
];
