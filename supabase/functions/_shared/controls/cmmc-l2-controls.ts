// =============================================================================
// INDEX DSaaS — CMMC Level 2 Control Mappings (NIST SP 800-171 Rev 2)
// All 110 practices across 14 domains mapped to Microsoft Graph API evidence
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.ts";

const FW: FrameworkId = "CMMC_L2";

export const cmmcL2Controls: ComplianceControl[] = [

  // ===========================================================================
  // ACCESS CONTROL (AC) — 22 controls  3.1.1 – 3.1.22
  // ===========================================================================

  {
    controlId: "AC.L2-3.1.1",
    title: "Authorized Access Control",
    description: "Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.1-ca", description: "Conditional Access policies restricting access to authorized users/devices", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.1-auth", description: "MFA registration details across all users", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA policies enforce access restrictions to authorized users and compliant devices", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AC.L2-3.1.2",
    title: "Transaction and Function Control",
    description: "Limit system access to types of transactions and functions that authorized users are permitted to execute.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.2-roles", description: "Directory role assignments restricting privileged functions", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "ac.1.2-ca", description: "Conditional Access policies with app and action filters", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Role-based access control limits users to authorized transactions and functions", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.3",
    title: "Control CUI Flow",
    description: "Control the flow of CUI in accordance with approved authorizations.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.3-aip-audit", description: "Audit logs for information protection / labeling activity", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
      { id: "ac.1.3-score", description: "Secure Score for DLP/AIP controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Sensitivity labels classify CUI and DLP policies prevent unauthorized information flow", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "AC.L2-3.1.4",
    title: "Separation of Duties",
    description: "Separate the duties of individuals to reduce the risk of malevolent activity without collusion.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.4-roles", description: "Role assignments showing separation of administrative duties", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "ac.1.4-role-defs", description: "Role definitions to assess scope of each privileged role", endpoint: "/roleManagement/directory/roleDefinitions", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "No single user holds conflicting privileged roles (e.g., Global Admin + Security Reader not the only admins)", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.5",
    title: "Least Privilege",
    description: "Employ the principle of least privilege, including for specific security functions and privileged accounts.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.5-roles", description: "Directory role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "ac.1.5-role-defs", description: "Role definitions", endpoint: "/roleManagement/directory/roleDefinitions", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Privileged roles are limited; Global Admin count ≤5; granular roles used instead of broad admin roles", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.6",
    title: "Non-Privileged Account Use",
    description: "Use non-privileged accounts or roles when accessing non-security functions.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.6-roles", description: "Privileged role assignments — identify users with both privileged and standard roles", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Privileged users have separate accounts for privileged functions; admin accounts not used for day-to-day tasks", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.7",
    title: "Privileged Functions",
    description: "Prevent non-privileged users from executing privileged functions and capture privileged function execution in audit logs.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.7-roles", description: "Privileged role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "ac.1.7-audit", description: "Audit logs capturing privileged operations", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Privileged roles are restricted and privileged operations are captured in audit logs", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.8",
    title: "Unsuccessful Logon Attempts",
    description: "Limit unsuccessful logon attempts.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.8-signin-failures", description: "Sign-in logs showing failed authentication attempts", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 50, selectFields: ["userPrincipalName","createdDateTime","status","ipAddress","riskLevelDuringSignIn"], filterExpression: "status/errorCode ne 0" },
      { id: "ac.1.8-ca", description: "Conditional Access policies with sign-in risk conditions", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Identity Protection or CA policies block/lock accounts after repeated failed sign-ins", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AC.L2-3.1.9",
    title: "Privacy and Security Notices",
    description: "Provide privacy and security notices consistent with CUI rules.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.9-ca-tou", description: "Conditional Access policies requiring terms of use acceptance", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Terms of Use (ToU) policy enforced via Conditional Access at sign-in", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AC.L2-3.1.10",
    title: "Session Lock",
    description: "Use session lock with pattern-hiding displays after a period of inactivity.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.10-device-config", description: "Device configuration profiles requiring screen lock/timeout", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies enforce screen lock with inactivity timeout ≤15 minutes", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.11",
    title: "Session Termination",
    description: "Terminate (automatically) a user session after a defined condition.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.11-ca-signin-freq", description: "Conditional Access sign-in frequency / session controls", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA policies enforce sign-in frequency (session re-authentication) and persistent browser session restrictions", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AC.L2-3.1.12",
    title: "Remote Access Control",
    description: "Monitor and control remote access sessions.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.12-ca", description: "Conditional Access policies controlling remote/external access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.12-signin", description: "Sign-in logs showing remote access activity", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["userPrincipalName","ipAddress","createdDateTime","status","clientAppUsed","deviceDetail"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Remote sessions are controlled via CA policies and sign-in logs capture remote access", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AC.L2-3.1.13",
    title: "Remote Access Confidentiality",
    description: "Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.13-ca", description: "CA policies requiring compliant/hybrid-joined devices for remote access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.13-score", description: "Secure Score for encryption-related controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Remote sessions require TLS/encrypted channels; devices must be compliant or hybrid-joined", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AC.L2-3.1.14",
    title: "Remote Access via Managed Points",
    description: "Route remote access via managed access control points.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.14-named-locations", description: "Named locations defining trusted network boundaries", endpoint: "/identity/conditionalAccess/namedLocations", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.14-ca", description: "CA policies restricting access from unmanaged access points", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Named locations defined; CA policies channel access through managed control points", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AC.L2-3.1.15",
    title: "Privileged Remote Access",
    description: "Authorize remote execution of privileged commands and access to security-relevant information via remote access only for documented operational needs.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.15-ca-privileged", description: "CA policies targeting privileged roles with stricter controls", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.15-pim", description: "Privileged Identity Management — eligible vs active role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Privileged remote access requires just-in-time activation (PIM) and dedicated CA policy", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AC.L2-3.1.16",
    title: "Wireless Access Authorization",
    description: "Authorize wireless access prior to allowing such connections.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.16-device-config", description: "Device compliance policies enforcing Wi-Fi/wireless connection restrictions", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ac.1.16-ca", description: "CA policies requiring compliant/managed devices for wireless scenarios", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Wireless access requires managed/compliant devices enforced by CA and device compliance policies", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.17",
    title: "Wireless Access Protection",
    description: "Protect wireless access using authentication and encryption.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.17-device-compliance", description: "Device compliance policies requiring encrypted connections", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies require encrypted wireless and device encryption", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.18",
    title: "Mobile Device Connection",
    description: "Control connection of mobile devices.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.18-device-compliance", description: "Mobile device compliance policies (iOS, Android)", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ac.1.18-ca-device", description: "CA policies requiring device compliance for mobile access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Mobile device compliance policies enforced via Intune MDM and CA requires device compliance", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.19",
    title: "Encrypt CUI on Mobile",
    description: "Encrypt CUI on mobile devices and mobile computing platforms.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.19-device-compliance", description: "Device compliance policies requiring encryption on mobile devices", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "All mobile device compliance policies require storage encryption (BitLocker/FileVault/device encryption)", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.20",
    title: "External System Connections",
    description: "Verify and control all connections to external systems.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.20-ca", description: "CA policies controlling external/B2B access and guest connections", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ac.1.20-score", description: "Secure Score controls for external sharing and collaboration", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "External access governed by CA policies; guest/B2B connections require approval and MFA", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AC.L2-3.1.21",
    title: "Portable Storage Use",
    description: "Limit use of portable storage devices on external systems.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.21-device-config", description: "Device configuration profiles restricting removable storage", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ac.1.21-aip-audit", description: "Audit logs for removable media / USB events", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device configuration profiles restrict or monitor USB/removable storage on managed devices", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AC.L2-3.1.22",
    title: "Control Public Information",
    description: "Control CUI posted or processed on publicly accessible information systems.",
    frameworkId: FW, family: "Access Control",
    evidenceQueries: [
      { id: "ac.1.22-aip-audit", description: "Information protection audit logs for public sharing events", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
      { id: "ac.1.22-score", description: "Secure Score for data sharing and external access controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "DLP policies prevent CUI from being posted to public systems; external sharing is restricted", customEvaluator: "evaluate_dlp_policies" },
  },

  // ===========================================================================
  // AWARENESS AND TRAINING (AT) — 3 controls  3.2.1 – 3.2.3
  // ===========================================================================

  {
    controlId: "AT.L2-3.2.1",
    title: "Role-Based Security Awareness",
    description: "Ensure that managers, systems administrators, and users of systems are made aware of the security risks associated with their activities.",
    frameworkId: FW, family: "Awareness and Training",
    evidenceQueries: [
      { id: "at.2.1-audit", description: "Audit logs for user training / security awareness activities", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"] },
      { id: "at.2.1-score", description: "Secure Score — user training/awareness control scores", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security awareness program evidence present; Secure Score training recommendations reviewed", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AT.L2-3.2.2",
    title: "Role-Based Security Training",
    description: "Ensure that personnel are trained to carry out their assigned information security responsibilities.",
    frameworkId: FW, family: "Awareness and Training",
    evidenceQueries: [
      { id: "at.2.2-score", description: "Secure Score for security training controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Role-based training program documented; privileged users receive additional security training", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AT.L2-3.2.3",
    title: "Insider Threat Awareness",
    description: "Provide security awareness training on recognizing and reporting potential threats.",
    frameworkId: FW, family: "Awareness and Training",
    evidenceQueries: [
      { id: "at.2.3-risky-users", description: "Identity Protection risky users indicating insider threat indicators", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 20, selectFields: ["id","userPrincipalName","riskLevel","riskState","riskDetail","riskLastUpdatedDateTime"] },
      { id: "at.2.3-alerts", description: "Security alerts for insider threat / anomalous activity", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Insider threat monitoring active; risky user detections reviewed; security awareness covers social engineering", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // AUDIT AND ACCOUNTABILITY (AU) — 9 controls  3.3.1 – 3.3.9
  // ===========================================================================

  {
    controlId: "AU.L2-3.3.1",
    title: "System Auditing",
    description: "Create and retain system audit logs and records to the extent needed to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized activity.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.1-dir-audit", description: "Directory audit log records", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"] },
      { id: "au.3.1-signin", description: "Sign-in audit records", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["userPrincipalName","userId","appDisplayName","ipAddress","createdDateTime","status"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Unified audit logging is active; directory and sign-in audit records are being generated and retained", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "AU.L2-3.3.2",
    title: "User Accountability",
    description: "Ensure that the actions of individual users can be uniquely traced back to those users.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.2-signin", description: "Sign-in logs with user identity attribution", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["userPrincipalName","userId","appDisplayName","ipAddress","createdDateTime","status"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit records contain userId, UPN, timestamp, source IP, and application — sufficient to uniquely attribute actions to individuals", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "AU.L2-3.3.3",
    title: "Event Review",
    description: "Review and update logged events.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.3-score", description: "Secure Score for audit log monitoring and review", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "au.3.3-alerts", description: "Security alerts generated from audit log review", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit events are reviewed regularly; security alerts generated from automated log analysis", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AU.L2-3.3.4",
    title: "Audit Failure Alerting",
    description: "Alert in the event of an audit logging process failure.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.4-alerts", description: "Security alerts for audit log failures or gaps", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "au.3.4-score", description: "Secure Score for audit monitoring coverage", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Alert rules configured to detect audit log failures; Microsoft Sentinel or Defender monitoring for audit gaps", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AU.L2-3.3.5",
    title: "Audit Correlation",
    description: "Correlate audit record review, analysis, and reporting processes for investigation and response to indications of unlawful, unauthorized, suspicious, or unusual activity.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.5-alerts", description: "Correlated security alerts from across systems", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "au.3.5-risk-detections", description: "Identity Protection risk detections correlated with sign-in events", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20, selectFields: ["id","riskEventType","riskLevel","riskState","ipAddress","activityDateTime","userPrincipalName"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Correlated security alerts are generated; Identity Protection correlates sign-in risk detections", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AU.L2-3.3.6",
    title: "Audit Reduction and Reporting",
    description: "Provide audit record reduction and report generation to support on-demand analysis and reporting.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.6-score", description: "Secure Score and reporting tools availability", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit reporting and reduction tools available (Sentinel, Defender for Cloud, Entra workbooks)", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AU.L2-3.3.7",
    title: "System Time Synchronization",
    description: "Provide a system capability that compares and synchronizes internal system clocks.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.7-device-compliance", description: "Device compliance policies (Intune-managed devices synchronize time via Azure AD)", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "au.3.7-audit", description: "Audit log timestamp consistency verification", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 5, selectFields: ["id","activityDateTime","result"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Azure AD-joined and Intune-managed devices synchronize time via Microsoft time servers; audit log timestamps are consistent", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AU.L2-3.3.8",
    title: "Protect Audit Information",
    description: "Protect audit information and audit tools from unauthorized access, modification, and deletion.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.8-roles", description: "Role assignments with access to audit logs (Security Reader, Compliance Admin)", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "au.3.8-score", description: "Secure Score for log protection controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit log access restricted to Security/Compliance roles; logs stored in protected workspace (Sentinel/Log Analytics)", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AU.L2-3.3.9",
    title: "Audit Management",
    description: "Limit management of audit logging to a subset of privileged users.",
    frameworkId: FW, family: "Audit and Accountability",
    evidenceQueries: [
      { id: "au.3.9-roles", description: "Role assignments that can manage audit configuration", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Only Compliance Admin / Security Admin roles can modify audit settings; changes captured in audit logs", customEvaluator: "evaluate_rbac" },
  },

  // ===========================================================================
  // CONFIGURATION MANAGEMENT (CM) — 9 controls  3.4.1 – 3.4.9
  // ===========================================================================

  {
    controlId: "CM.L2-3.4.1",
    title: "System Baselining",
    description: "Establish and maintain baseline configurations and inventories of organizational systems.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.1-device-compliance", description: "Device compliance policies defining configuration baselines", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "cm.4.1-score", description: "Secure Score for configuration baseline controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune device compliance/configuration policies define and enforce configuration baselines for all managed endpoints", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "CM.L2-3.4.2",
    title: "Security Configuration Enforcement",
    description: "Establish and enforce security configuration settings for information technology products employed in organizational systems.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.2-device-compliance", description: "Device compliance policies enforcing security settings", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "cm.4.2-secure-score", description: "Secure Score for security configuration controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security baselines deployed via Intune; Secure Score ≥70%; non-compliant devices blocked or remediated", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "CM.L2-3.4.3",
    title: "Change Control",
    description: "Track, review, approve, and log changes to systems.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.3-audit", description: "Directory audit logs for configuration changes", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Configuration changes are captured in directory audit logs with actor, timestamp, and result", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "CM.L2-3.4.4",
    title: "Security Impact Analysis",
    description: "Analyze the security impact of changes prior to implementation.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.4-audit", description: "Audit logs for change management / policy changes", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"], filterExpression: "category eq 'Policy'" },
      { id: "cm.4.4-score", description: "Secure Score for change management controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Policy changes logged with evidence of review; security impact assessed prior to deployment", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "CM.L2-3.4.5",
    title: "Access Restrictions for Change",
    description: "Define, document, approve, and enforce physical and logical access restrictions associated with changes to systems.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.5-roles", description: "Role assignments controlling who can make configuration changes", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "cm.4.5-ca", description: "CA policies restricting configuration change operations to authorized personnel", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Configuration change access restricted to authorized roles; changes require MFA and are logged", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "CM.L2-3.4.6",
    title: "Least Functionality",
    description: "Employ the principle of least functionality by configuring systems to provide only essential capabilities.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.6-device-compliance", description: "Device compliance and configuration profiles restricting non-essential features", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "cm.4.6-score", description: "Secure Score for least functionality controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune configuration profiles restrict non-essential applications, features, and ports on managed devices", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "CM.L2-3.4.7",
    title: "Nonessential Components",
    description: "Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.7-device-config", description: "Device compliance policies restricting unnecessary services and ports", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device configuration profiles disable unnecessary services; firewall rules restrict unauthorized ports", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "CM.L2-3.4.8",
    title: "Application Deny-Listing",
    description: "Apply deny-by-exception (deny-listing) policy to prevent use of unauthorized software.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.8-device-compliance", description: "Device compliance policies with non-compliant app restrictions", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "cm.4.8-score", description: "Secure Score for application control / allowlisting", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune or Defender for Endpoint enforce application control policies restricting unauthorized software", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "CM.L2-3.4.9",
    title: "User-Installed Software",
    description: "Control and monitor user-installed software.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "cm.4.9-device-compliance", description: "Device compliance policies monitoring installed software", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "cm.4.9-audit", description: "Audit logs for software installation events", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune MDM monitors and controls user-installed applications; non-compliant software triggers remediation", customEvaluator: "evaluate_device_compliance" },
  },

  // ===========================================================================
  // IDENTIFICATION AND AUTHENTICATION (IA) — 11 controls  3.5.1 – 3.5.11
  // ===========================================================================

  {
    controlId: "IA.L2-3.5.1",
    title: "User Identification",
    description: "Identify system users, processes acting on behalf of users, and devices.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.1-users", description: "User accounts in the directory", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 50, selectFields: ["id","userPrincipalName","displayName","accountEnabled","userType","createdDateTime"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "All users have unique identifiers; service accounts and devices are identifiable in the directory", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "IA.L2-3.5.2",
    title: "Authentication",
    description: "Authenticate (or verify) the identities of users, processes, or devices before allowing access.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.2-ca", description: "CA policies requiring authentication for all access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ia.5.2-auth", description: "Authentication methods registered by users", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "All users authenticate via Azure AD before accessing any resource; no bypass of authentication", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.3",
    title: "Multifactor Authentication",
    description: "Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.3-ca-mfa", description: "Conditional Access policies requiring MFA", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ia.5.3-auth-methods", description: "MFA registration details for all users", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA policy requires MFA for all users; ≥95% of users registered for MFA", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.4",
    title: "Replay-Resistant Authentication",
    description: "Employ replay-resistant authentication mechanisms.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.4-auth-methods", description: "Authentication methods policy — FIDO2/Windows Hello/certificate auth", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "identityProtection", requiredPermissions: ["Policy.Read.All"] },
      { id: "ia.5.4-ca", description: "CA policies requiring phishing-resistant MFA", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Phishing-resistant methods (FIDO2, Windows Hello, certificate) enabled and preferred; Authenticator configured for replay protection", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.5",
    title: "Identifier Management",
    description: "Employ identifier management — prevent reuse, disable inactive accounts.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.5-users", description: "User accounts including disabled/inactive accounts", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 100, selectFields: ["id","userPrincipalName","accountEnabled","lastPasswordChangeDateTime","createdDateTime","userType"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Stale accounts disabled; no duplicate identifiers; guest/service accounts identified and managed", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "IA.L2-3.5.6",
    title: "Disable Inactive Identifiers",
    description: "Disable identifiers after a defined period of inactivity.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.6-users", description: "User accounts with last sign-in data", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 100, selectFields: ["id","userPrincipalName","accountEnabled","signInActivity","lastPasswordChangeDateTime"] },
      { id: "ia.5.6-score", description: "Secure Score for stale account management", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Accounts inactive >90 days are disabled or reviewed; Entra ID lifecycle policies or access reviews configured", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "IA.L2-3.5.7",
    title: "Password Complexity",
    description: "Enforce a minimum password complexity and change requirements.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.7-auth-methods", description: "Authentication methods policy (password settings, banned passwords)", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "identityProtection", requiredPermissions: ["Policy.Read.All"] },
      { id: "ia.5.7-score", description: "Secure Score for password policy controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Password protection enabled (Azure AD Password Protection); banned password list configured; complexity requirements enforced", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.8",
    title: "Password Reuse Prohibition",
    description: "Prohibit password reuse for a specified number of generations.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.8-auth-methods", description: "Password policy settings (password history)", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "identityProtection", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Password history policy prevents reuse of last 24 passwords; SSPR configured with complexity enforcement", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.9",
    title: "Temporary Passwords",
    description: "Allow temporary password use with an immediate required change.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.9-auth-methods", description: "Temporary Access Pass (TAP) authentication method policy", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "identityProtection", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Temporary Access Pass (TAP) configured with short lifetime and single-use; forced password change on next sign-in enforced", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.10",
    title: "Cryptographically Protected Passwords",
    description: "Store and transmit only cryptographically protected passwords.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.10-score", description: "Secure Score for credential protection and password hash sync security", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "ia.5.10-ca", description: "CA policies requiring modern authentication (no legacy auth)", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Legacy authentication blocked via CA policy; passwords stored as cryptographic hashes in Azure AD; modern auth enforced", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "IA.L2-3.5.11",
    title: "Obscure Authentication Feedback",
    description: "Obscure feedback of authentication information.",
    frameworkId: FW, family: "Identification and Authentication",
    evidenceQueries: [
      { id: "ia.5.11-ca", description: "CA policies — sign-in error message configuration (prevent enumeration)", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Authentication error messages are generic (not revealing whether username or password was incorrect); password fields masked", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // INCIDENT RESPONSE (IR) — 3 controls  3.6.1 – 3.6.3
  // ===========================================================================

  {
    controlId: "IR.L2-3.6.1",
    title: "Incident Handling",
    description: "Establish an operational incident handling capability that includes preparation, detection, analysis, containment, recovery, and user response activities.",
    frameworkId: FW, family: "Incident Response",
    evidenceQueries: [
      { id: "ir.6.1-alerts", description: "Security incidents and alerts from Microsoft Defender/Sentinel", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "ir.6.1-score", description: "Secure Score for incident response posture", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security alerts are actively monitored; Microsoft Defender / Sentinel deployed as SIEM/SOAR; incident workflow defined", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "IR.L2-3.6.2",
    title: "Incident Reporting",
    description: "Track, document, and report incidents to designated officials and/or authorities.",
    frameworkId: FW, family: "Incident Response",
    evidenceQueries: [
      { id: "ir.6.2-alerts", description: "Security alerts with severity, status, and assignments for tracking", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "ir.6.2-risky", description: "Risky users flagged for investigation and remediation", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 20, selectFields: ["id","userPrincipalName","riskLevel","riskState","riskDetail","riskLastUpdatedDateTime"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Incidents tracked in ticketing system; security alerts assigned and resolved; DIVS reporting process documented", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "IR.L2-3.6.3",
    title: "Incident Response Testing",
    description: "Test the organizational incident response capability.",
    frameworkId: FW, family: "Incident Response",
    evidenceQueries: [
      { id: "ir.6.3-audit", description: "Audit logs for security drill or tabletop exercise activities", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"] },
      { id: "ir.6.3-score", description: "Secure Score for incident response readiness controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Incident response tabletop exercise conducted annually; test results documented; plan updated accordingly", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // MAINTENANCE (MA) — 6 controls  3.7.1 – 3.7.6
  // ===========================================================================

  {
    controlId: "MA.L2-3.7.1",
    title: "Controlled Maintenance",
    description: "Perform maintenance on organizational systems.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.1-device-compliance", description: "Device compliance policies for patch status and update compliance", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ma.7.1-score", description: "Secure Score for patch management controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies require OS/patch updates; non-compliant devices blocked; patching schedule documented", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MA.L2-3.7.2",
    title: "Maintenance Controls",
    description: "Provide controls on the tools, techniques, mechanisms, and personnel for maintenance.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.2-roles", description: "Role assignments for maintenance personnel access", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "ma.7.2-audit", description: "Audit logs for maintenance-related configuration changes", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Maintenance access restricted to authorized personnel; maintenance activities logged and reviewed", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "MA.L2-3.7.3",
    title: "Equipment Sanitization",
    description: "Ensure equipment removed for maintenance outside protected areas is sanitized of any CUI.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.3-device-compliance", description: "Device wipe/retirement records from Intune MDM", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune MDM remote wipe capability configured; device retirement procedure includes data sanitization verification", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MA.L2-3.7.4",
    title: "Media Sanitization Check",
    description: "Check media containing diagnostic and test programs for malicious code before use.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.4-alerts", description: "Malware/threat detection alerts from Defender for Endpoint", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "ma.7.4-score", description: "Secure Score for anti-malware controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Defender for Endpoint scans all media at use; malware detections alerted and remediated", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "MA.L2-3.7.5",
    title: "MFA for Remote Maintenance",
    description: "Require MFA to establish nonlocal maintenance sessions via external networks.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.5-ca-mfa", description: "CA policies requiring MFA for remote/administrative access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA policy requires MFA for all remote maintenance sessions; admin access requires phishing-resistant MFA", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "MA.L2-3.7.6",
    title: "Maintenance Personnel",
    description: "Supervise maintenance activities of personnel without required access authorization.",
    frameworkId: FW, family: "Maintenance",
    evidenceQueries: [
      { id: "ma.7.6-audit", description: "Audit logs capturing maintenance personnel activities", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Maintenance personnel access logged; guest/contractor accounts time-limited and supervised", customEvaluator: "evaluate_audit_logging" },
  },

  // ===========================================================================
  // MEDIA PROTECTION (MP) — 9 controls  3.8.1 – 3.8.9
  // ===========================================================================

  {
    controlId: "MP.L2-3.8.1",
    title: "Media Protection",
    description: "Protect (i.e., physically control and securely store) system media containing CUI, both paper and digital.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.1-device-compliance", description: "Device compliance policies requiring storage encryption (BitLocker/FileVault)", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies require full-disk encryption on all managed devices holding CUI", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MP.L2-3.8.2",
    title: "Media Access",
    description: "Limit access to CUI on system media to authorized users.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.2-ca", description: "CA policies controlling access to systems storing CUI on media", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "mp.8.2-roles", description: "Role-based access controls limiting CUI data access", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "RBAC and CA policies restrict access to storage containing CUI to authorized personnel only", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "MP.L2-3.8.3",
    title: "Media Sanitization",
    description: "Sanitize or destroy system media before disposal or reuse.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.3-device-audit", description: "Audit logs for device retirement and data wipe operations", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'DeviceManagement'" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune remote wipe records exist for retired devices; disposal procedure requires sanitization certification", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "MP.L2-3.8.4",
    title: "Media Markings",
    description: "Mark media with necessary CUI markings and distribution limitations.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.4-aip-audit", description: "Information protection labeling audit logs", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
      { id: "mp.8.4-score", description: "Secure Score for information protection / labeling", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Microsoft Purview sensitivity labels configured with CUI markings and applied to documents/emails", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "MP.L2-3.8.5",
    title: "Media Accountability",
    description: "Control access to media containing CUI and maintain accountability during transport.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.5-audit", description: "Audit logs tracking media access and transfers", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Chain of custody maintained for CUI media; access logs track who accessed or transferred media", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "MP.L2-3.8.6",
    title: "Portable Storage Encryption",
    description: "Implement cryptographic mechanisms to protect the confidentiality of CUI during transport unless protected by alternative physical safeguards.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.6-device-compliance", description: "Device compliance policies requiring portable storage encryption", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "BitLocker To Go or equivalent required for USB drives holding CUI; configuration profiles enforce encryption on removable media", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MP.L2-3.8.7",
    title: "Removable Media Control",
    description: "Control the use of removable media on system components.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.7-device-config", description: "Device configuration profiles restricting/controlling USB/removable media", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Intune configuration profiles restrict USB/removable media use; only approved devices allowed; policy enforced via Defender for Endpoint", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MP.L2-3.8.8",
    title: "Prohibit Unidentified Portable Storage",
    description: "Prohibit the use of portable storage devices when such devices have no identifiable owner.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.8-device-config", description: "Device compliance policies blocking unidentified/unmanaged storage devices", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Configuration profiles block unknown/unidentified USB storage; only organization-owned and labeled media allowed", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "MP.L2-3.8.9",
    title: "Protect Backup CUI",
    description: "Protect the confidentiality of backup CUI at storage locations.",
    frameworkId: FW, family: "Media Protection",
    evidenceQueries: [
      { id: "mp.8.9-device-compliance", description: "Device compliance policies requiring backup encryption", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "mp.8.9-score", description: "Secure Score for data protection at rest controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Backup data encrypted at rest; Azure Backup or equivalent uses encryption; CUI backup access restricted", customEvaluator: "evaluate_device_compliance" },
  },

  // ===========================================================================
  // PERSONNEL SECURITY (PS) — 2 controls  3.9.1 – 3.9.2
  // ===========================================================================

  {
    controlId: "PS.L2-3.9.1",
    title: "Screen Individuals",
    description: "Screen individuals prior to authorizing access to systems containing CUI.",
    frameworkId: FW, family: "Personnel Security",
    evidenceQueries: [
      { id: "ps.9.1-users", description: "User accounts and creation dates for new joiners", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 50, selectFields: ["id","userPrincipalName","displayName","accountEnabled","createdDateTime","userType"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "New user accounts not provisioned until background check complete; HR-to-IT provisioning process documented", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "PS.L2-3.9.2",
    title: "Personnel Termination and Transfer",
    description: "Ensure that CUI is protected during and after personnel actions such as terminations and transfers.",
    frameworkId: FW, family: "Personnel Security",
    evidenceQueries: [
      { id: "ps.9.2-users", description: "Disabled accounts and recent account changes", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 50, selectFields: ["id","userPrincipalName","accountEnabled","createdDateTime","userType"] },
      { id: "ps.9.2-audit", description: "Audit logs for account disable/deletion during offboarding", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result","initiatedBy"], filterExpression: "activityDisplayName eq 'Disable account' or activityDisplayName eq 'Delete user'" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Offboarding process disables accounts same-day; audit logs show timely termination actions; data access revoked on departure", customEvaluator: "evaluate_audit_logging" },
  },

  // ===========================================================================
  // PHYSICAL PROTECTION (PE) — 6 controls  3.10.1 – 3.10.6
  // ===========================================================================

  {
    controlId: "PE.L2-3.10.1",
    title: "Limit Physical Access",
    description: "Limit physical access to organizational systems, equipment, and respective operating environments to authorized individuals.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.1-device-compliance", description: "Managed device inventory — only enrolled devices can access systems", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "pe.10.1-ca", description: "CA policies requiring compliant/managed devices (logical enforcement of physical access)", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Logical access controls (CA + device compliance) complement physical access controls; facility access control procedures documented", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "PE.L2-3.10.2",
    title: "Protect Physical Facility",
    description: "Protect and monitor the physical facility and support infrastructure for systems.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.2-alerts", description: "Security alerts for physical infrastructure anomalies", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Physical security monitoring in place at data center/server room; Microsoft Azure data center physical security inherited for cloud workloads", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "PE.L2-3.10.3",
    title: "Visitor Control",
    description: "Escort visitors and monitor visitor activity.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.3-users-guest", description: "Guest user accounts in directory (logical correlate to physical visitors)", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], topN: 50, selectFields: ["id","userPrincipalName","userType","accountEnabled","createdDateTime"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Physical visitor log maintained; guest accounts in directory have limited access and time-bound provisioning; visitor escort policy documented", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "PE.L2-3.10.4",
    title: "Audit Physical Access Logs",
    description: "Maintain audit logs of physical access.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.4-audit", description: "Audit logs for physical-to-logical correlation (badge access system exports / device sign-ins from facility)", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["userPrincipalName","createdDateTime","status","ipAddress","deviceDetail"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Physical access logs maintained at facility (badge system/CCTV); Azure AD sign-in logs corroborate physical presence patterns", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "PE.L2-3.10.5",
    title: "Physical Access Devices",
    description: "Control and manage physical access devices.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.5-device-compliance", description: "Managed device inventory and compliance states", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Badge/key inventory maintained; Intune-managed devices represent controlled access devices; lost device procedures documented", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "PE.L2-3.10.6",
    title: "Alternate Work Sites",
    description: "Enforce safeguarding measures for CUI at alternate work sites.",
    frameworkId: FW, family: "Physical Protection",
    evidenceQueries: [
      { id: "pe.10.6-ca", description: "CA policies applying security controls regardless of work location", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "pe.10.6-device-compliance", description: "Device compliance policies applying uniformly to remote/home office devices", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security controls apply uniformly at alternate work sites via CA and device compliance; remote work security policy documented", customEvaluator: "evaluate_mfa_enforcement" },
  },

  // ===========================================================================
  // RISK ASSESSMENT (RA) — 3 controls  3.11.1 – 3.11.3
  // ===========================================================================

  {
    controlId: "RA.L2-3.11.1",
    title: "Risk Assessment",
    description: "Periodically assess the risk to organizational operations, assets, and individuals from system operations.",
    frameworkId: FW, family: "Risk Assessment",
    evidenceQueries: [
      { id: "ra.11.1-score", description: "Microsoft Secure Score as continuous risk posture indicator", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
      { id: "ra.11.1-risk-detections", description: "Identity risk detections indicating risk assessment signals", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20, selectFields: ["id","riskEventType","riskLevel","riskState","ipAddress","activityDateTime","userPrincipalName"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Risk assessment conducted annually; Secure Score and identity risk detections used as continuous risk indicators", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "RA.L2-3.11.2",
    title: "Vulnerability Scanning",
    description: "Scan for vulnerabilities in organizational systems and applications periodically.",
    frameworkId: FW, family: "Risk Assessment",
    evidenceQueries: [
      { id: "ra.11.2-score", description: "Secure Score tracking vulnerability and configuration posture", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
      { id: "ra.11.2-risk-detections", description: "Risk detections indicating active vulnerability exploitation attempts", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20, selectFields: ["id","riskEventType","riskLevel","riskState","ipAddress","activityDateTime","userPrincipalName"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Vulnerability scans conducted monthly; Defender for Endpoint TVM or equivalent deployed; findings tracked to remediation", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "RA.L2-3.11.3",
    title: "Vulnerability Remediation",
    description: "Remediate vulnerabilities in accordance with risk assessments.",
    frameworkId: FW, family: "Risk Assessment",
    evidenceQueries: [
      { id: "ra.11.3-score", description: "Secure Score improvement over time (remediation trending)", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
      { id: "ra.11.3-alerts-resolved", description: "Resolved security alerts showing vulnerability remediation", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Critical/High vulnerabilities remediated within 15/30 days; Secure Score trend shows improvement; remediation plan documented", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // SECURITY ASSESSMENT (CA) — 4 controls  3.12.1 – 3.12.4
  // ===========================================================================

  {
    controlId: "CA.L2-3.12.1",
    title: "Security Control Assessments",
    description: "Periodically assess the security controls in organizational systems to determine if they are effective.",
    frameworkId: FW, family: "Security Assessment",
    evidenceQueries: [
      { id: "ca.12.1-score", description: "Secure Score with control-by-control assessment", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
      { id: "ca.12.1-score-profiles", description: "Secure Score control details showing individual control effectiveness", endpoint: "/security/secureScoreControlProfiles", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Annual security control assessment performed; Secure Score Control Profiles reviewed; assessment results documented in POA&M", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "CA.L2-3.12.2",
    title: "Plan of Action",
    description: "Develop and implement plans of action to correct deficiencies and reduce or eliminate vulnerabilities.",
    frameworkId: FW, family: "Security Assessment",
    evidenceQueries: [
      { id: "ca.12.2-score", description: "Secure Score recommended actions (basis for POA&M)", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
      { id: "ca.12.2-alerts", description: "Open security alerts representing deficiencies requiring POA&M entries", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "POA&M document maintained; Secure Score recommended actions mapped to POA&M items; deficiencies tracked to closure", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "CA.L2-3.12.3",
    title: "Security Control Monitoring",
    description: "Monitor security controls on an ongoing basis to ensure the continued effectiveness of the controls.",
    frameworkId: FW, family: "Security Assessment",
    evidenceQueries: [
      { id: "ca.12.3-score", description: "Secure Score over time for continuous monitoring", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
      { id: "ca.12.3-alerts", description: "Active security alerts indicating control failures", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Continuous monitoring via Defender/Sentinel; Secure Score reviewed monthly; control effectiveness tracked with trend data", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "CA.L2-3.12.4",
    title: "System Security Plan",
    description: "Develop, document, and periodically update system security plans that describe the system boundary, operating environment, security requirements, and controls in place.",
    frameworkId: FW, family: "Security Assessment",
    evidenceQueries: [
      { id: "ca.12.4-score", description: "Secure Score as technical basis for SSP controls section", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "ca.12.4-roles", description: "System owner and administrator role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "SSP document exists, reviewed annually, covers system boundary and all CMMC L2 controls; approval authority designated", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // SYSTEM AND COMMUNICATIONS PROTECTION (SC) — 16 controls  3.13.1 – 3.13.16
  // ===========================================================================

  {
    controlId: "SC.L2-3.13.1",
    title: "Boundary Protection",
    description: "Monitor, control, and protect communications at the external boundaries and key internal boundaries of systems.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.1-ca", description: "CA policies controlling boundary access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "sc.13.1-alerts", description: "Security alerts for boundary violations or anomalous traffic", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA enforces boundary controls; Microsoft Defender for Office 365 and Defender for Endpoint protect email/endpoint boundaries", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.2",
    title: "Security Architecture",
    description: "Employ architectural designs, software development techniques, and systems engineering principles promoting security.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.2-score", description: "Secure Score for security architecture controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "sc.13.2-ca", description: "CA policies reflecting Zero Trust architecture principles", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Zero Trust architecture implemented; CA enforces verify explicitly, least privilege; security design documented", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.3",
    title: "Role Separation",
    description: "Separate user functionality from system management functionality.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.3-roles", description: "Role assignments confirming separation of user vs. admin roles", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "sc.13.3-ca", description: "CA policies applying different access controls to admin vs. user scenarios", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Administrative functions separated from user functions; admins use dedicated admin accounts; admin access requires stricter CA controls", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "SC.L2-3.13.4",
    title: "Shared Resource Control",
    description: "Prevent unauthorized and unintended information transfer via shared system resources.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.4-aip-audit", description: "Information protection audit for unauthorized sharing", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
      { id: "sc.13.4-score", description: "Secure Score for DLP controls preventing unintended data transfer", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "DLP policies prevent unintended information transfer across shared resources; sensitivity labels restrict access", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "SC.L2-3.13.5",
    title: "Public-Access System Separation",
    description: "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.5-named-loc", description: "Named locations defining network zones and trust boundaries", endpoint: "/identity/conditionalAccess/namedLocations", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "sc.13.5-ca", description: "CA policies applying stricter controls to access from untrusted networks", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Public-facing systems in DMZ/separate network; Azure network segmentation implemented; CA policies differentiate trusted vs. untrusted network zones", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.6",
    title: "Deny by Default",
    description: "Deny network communications traffic by default and allow by exception (i.e., deny all, permit by exception).",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.6-ca", description: "CA policies with default deny posture (block all, allow specific conditions)", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "sc.13.6-score", description: "Secure Score for deny-by-default network controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA policy baseline blocks all access by default; exceptions explicitly defined; network security groups enforce default-deny", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "SC.L2-3.13.7",
    title: "Split Tunneling",
    description: "Prevent remote devices from simultaneously using non-remote connections with split tunneling.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.7-device-config", description: "Device configuration profiles disabling VPN split tunneling", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "VPN configuration disables split tunneling; all traffic forced through managed connection; Intune enforces VPN profile", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SC.L2-3.13.8",
    title: "CUI Transmission Confidentiality",
    description: "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission unless otherwise protected by alternative physical safeguards.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.8-aip-audit", description: "Information protection audit for data in transit protections", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
      { id: "sc.13.8-score", description: "Secure Score for encryption in transit controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "TLS 1.2+ enforced for all communications; legacy protocols blocked; sensitivity labels encrypt CUI in email/docs", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "SC.L2-3.13.9",
    title: "Network Disconnect",
    description: "Terminate network connections after a defined period of inactivity.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.9-ca-session", description: "CA sign-in frequency and persistent session controls", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "CA session controls enforce re-authentication after inactivity; persistent browser sessions disabled for sensitive apps", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "SC.L2-3.13.10",
    title: "Key Management",
    description: "Establish and manage cryptographic keys for required cryptography.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.10-score", description: "Secure Score for key management and certificate controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Cryptographic key management via Azure Key Vault; key rotation policy documented; certificate expiry monitoring configured", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.11",
    title: "FIPS-Validated Cryptography",
    description: "Employ FIPS-validated cryptography when used to protect the confidentiality of CUI.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.11-device-compliance", description: "Device compliance requiring FIPS-validated encryption (Windows FIPS mode)", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "sc.13.11-score", description: "Secure Score for FIPS cryptographic controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Windows FIPS mode enabled via Intune policy; Azure services use FIPS 140-2 validated modules; TLS 1.2+ with FIPS cipher suites", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SC.L2-3.13.12",
    title: "Collaborative Computing Devices",
    description: "Prohibit remote activation of collaborative computing devices and provide indication of use to present users.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.12-device-config", description: "Device configuration profiles controlling camera/mic activation", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Camera/microphone access controlled via Intune configuration profiles; remote activation prevention policy documented; LED indicators required", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SC.L2-3.13.13",
    title: "Mobile Code",
    description: "Control and monitor the use of mobile code.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.13-device-compliance", description: "Device compliance and browser policies controlling mobile code execution", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "sc.13.13-alerts", description: "Alerts for malicious script/mobile code execution", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Browser policies control JavaScript/ActiveX; Defender SmartScreen blocks malicious downloads; mobile code from untrusted sources blocked", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.14",
    title: "VoIP",
    description: "Control and monitor the use of VoIP technologies.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.14-ca", description: "CA policies controlling access to Teams/VoIP applications", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "VoIP (Teams/Skype) access controlled via CA policies; external VoIP restricted or monitored; call recording and retention policies configured", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SC.L2-3.13.15",
    title: "Communications Session Authenticity",
    description: "Protect the authenticity of communications sessions.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.15-ca", description: "CA policies requiring device compliance and user authentication for sessions", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "sc.13.15-auth-methods", description: "Strong authentication methods ensuring session authenticity", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "identityProtection", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Session tokens protected via modern authentication; replay-resistant MFA ensures session authenticity; anti-session-hijacking controls active", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "SC.L2-3.13.16",
    title: "CUI at Rest",
    description: "Protect the confidentiality of CUI at rest.",
    frameworkId: FW, family: "System and Communications Protection",
    evidenceQueries: [
      { id: "sc.13.16-device-compliance", description: "Device compliance requiring full-disk encryption at rest", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "sc.13.16-aip-audit", description: "Information protection audit for encryption of data at rest", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10, selectFields: ["id","category","activityDisplayName","activityDateTime","result"], filterExpression: "category eq 'InformationProtectionPolicy'" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "BitLocker/FileVault encryption enforced on all devices; SharePoint/OneDrive encrypted at rest; sensitivity labels encrypt CUI files at rest", customEvaluator: "evaluate_device_compliance" },
  },

  // ===========================================================================
  // SYSTEM AND INFORMATION INTEGRITY (SI) — 7 controls  3.14.1 – 3.14.7
  // ===========================================================================

  {
    controlId: "SI.L2-3.14.1",
    title: "Flaw Remediation",
    description: "Identify, report, and correct information and information system flaws in a timely manner.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.1-device-compliance", description: "Device compliance policies requiring current OS and patch levels", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "si.14.1-score", description: "Secure Score for patch and vulnerability remediation", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Patch compliance enforced via Intune; critical patches deployed within 15 days; flaw remediation SLA documented", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SI.L2-3.14.2",
    title: "Malicious Code Protection",
    description: "Provide protection from malicious code at appropriate locations within organizational systems.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.2-device-compliance", description: "Device compliance policies requiring anti-malware/Defender", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "si.14.2-alerts", description: "Malware and threat detection alerts", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Defender for Endpoint deployed and active on all managed devices; real-time protection and cloud-delivered protection enabled; threats detected and remediated", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SI.L2-3.14.3",
    title: "Security Alerts and Advisories",
    description: "Monitor system security alerts and advisories and take action in response.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.3-alerts", description: "Security alerts and advisories from Microsoft Defender", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 30 },
      { id: "si.14.3-score", description: "Secure Score reflecting response to security advisories", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 5 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Microsoft Security Update emails configured; Secure Score alerts reviewed; Defender alerts triaged within SLA", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SI.L2-3.14.4",
    title: "Update Malicious Code Protection",
    description: "Update malicious code protection mechanisms when new releases are available.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.4-device-compliance", description: "Device compliance policies requiring up-to-date antivirus definitions", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance requires antivirus definitions current within 24 hours; automatic updates enabled via Intune/Windows Update for Business", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SI.L2-3.14.5",
    title: "Security Scans",
    description: "Perform periodic scans of systems and real-time scans of files from external sources.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.5-device-compliance", description: "Device compliance policies requiring active malware scanning", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "si.14.5-alerts", description: "Malware scan results and threat detections", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Defender for Endpoint performs scheduled and real-time scans; email attachments scanned by Defender for Office 365; scan results reviewed", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "SI.L2-3.14.6",
    title: "Monitor for Attacks",
    description: "Monitor systems to detect attacks and indicators of potential attacks.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.6-alerts", description: "Security alerts for attack detection and IOCs", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 30 },
      { id: "si.14.6-risk-detections", description: "Identity Protection risk detections indicating attack activity", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 30, selectFields: ["id","riskEventType","riskLevel","riskState","ipAddress","activityDateTime","userPrincipalName"] },
      { id: "si.14.6-risky-users", description: "Risky users flagged by Identity Protection attack detection", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 20, selectFields: ["id","userPrincipalName","riskLevel","riskState","riskDetail","riskLastUpdatedDateTime"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Defender SIEM/SOAR actively monitors for attack patterns; Identity Protection detects and alerts on anomalous sign-in patterns; Sentinel deployed", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "SI.L2-3.14.7",
    title: "Identify Unauthorized Use",
    description: "Identify unauthorized use of systems.",
    frameworkId: FW, family: "System and Information Integrity",
    evidenceQueries: [
      { id: "si.14.7-risky-users", description: "Risky users indicating potential unauthorized access", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 30, selectFields: ["id","userPrincipalName","riskLevel","riskState","riskDetail","riskLastUpdatedDateTime"] },
      { id: "si.14.7-risk-detections", description: "Risk detections for unauthorized use patterns (token theft, impossible travel, etc.)", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 30, selectFields: ["id","riskEventType","riskLevel","riskState","ipAddress","activityDateTime","userPrincipalName"] },
      { id: "si.14.7-signin", description: "Sign-in logs for anomalous patterns indicating unauthorized use", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 30, selectFields: ["userPrincipalName","ipAddress","createdDateTime","status","riskLevelDuringSignIn","location"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Identity Protection detects unauthorized access patterns; anomalous sign-in alerts triggered; UBA/behavior analytics active in Sentinel/Defender", customEvaluator: "evaluate_evidence_exists" },
  },
];
