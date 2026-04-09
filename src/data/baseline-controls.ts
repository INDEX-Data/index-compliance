// =============================================================================
// Current State Baseline — Industry Best Practices for Microsoft 365 Security
//
// A framework-agnostic assessment of M365 security posture covering identity,
// device, data protection, monitoring, and configuration management.
// Reuses existing Graph API endpoints and compliance engine evaluators.
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";

const FW: FrameworkId = "BASELINE";

export const baselineControls: ComplianceControl[] = [

  // ===========================================================================
  // IDENTITY & ACCESS — 6 controls
  // ===========================================================================

  {
    controlId: "BL-IAM-01",
    title: "MFA Enforcement",
    description: "Multi-factor authentication is enforced for all users via Conditional Access policies.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.01-ca", description: "Conditional Access policies enforcing MFA", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "bl.iam.01-reg", description: "MFA registration status across users", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Conditional Access policies enforce MFA for all users", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "BL-IAM-02",
    title: "MFA Coverage",
    description: "At least 90% of users have registered for multi-factor authentication.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.02-reg", description: "User MFA registration details", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 999 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "90%+ of users have registered for MFA", customEvaluator: "evaluate_mfa_coverage" },
  },

  {
    controlId: "BL-IAM-03",
    title: "Privileged Role Limits",
    description: "Global Administrator accounts are limited (5 or fewer) and granular roles are used.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.03-roles", description: "Directory role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "bl.iam.03-defs", description: "Role definitions", endpoint: "/roleManagement/directory/roleDefinitions", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Global Admin count is 5 or fewer; granular roles used", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "BL-IAM-04",
    title: "Conditional Access Policies",
    description: "Conditional Access policies are configured to control access based on conditions (location, device, risk).",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.04-ca", description: "Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Multiple Conditional Access policies are active and enabled", customEvaluator: "evaluate_policy_exists" },
  },

  {
    controlId: "BL-IAM-05",
    title: "Guest Access Controls",
    description: "External/guest user access is governed by policies restricting permissions and access scope.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.05-auth", description: "Authorization policy for guest access", endpoint: "/policies/authorizationPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "bl.iam.05-guests", description: "Guest users in directory", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], filterExpression: "userType eq 'Guest'", topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Guest access is restricted; guest invite settings are not 'everyone'", customEvaluator: "evaluate_guest_access" },
  },

  {
    controlId: "BL-IAM-06",
    title: "Legacy Authentication Blocking",
    description: "Legacy authentication protocols (IMAP, POP3, SMTP) are blocked via Conditional Access.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.06-ca", description: "Conditional Access policies blocking legacy auth", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "A Conditional Access policy blocks legacy authentication protocols", customEvaluator: "evaluate_configuration_management" },
  },

  // ===========================================================================
  // DEVICE SECURITY — 4 controls
  // ===========================================================================

  {
    controlId: "BL-DEV-01",
    title: "Device Compliance Policies",
    description: "Device compliance policies are configured to enforce security baselines on managed devices.",
    frameworkId: FW, family: "Device Security",
    evidenceQueries: [
      { id: "bl.dev.01-pol", description: "Device compliance policies", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies are configured and active", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "BL-DEV-02",
    title: "Managed Device Coverage",
    description: "Devices accessing corporate resources are enrolled in device management (Intune).",
    frameworkId: FW, family: "Device Security",
    evidenceQueries: [
      { id: "bl.dev.02-devices", description: "Managed devices inventory", endpoint: "/deviceManagement/managedDevices", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementManagedDevices.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Devices are enrolled in Intune/MDM for management", customEvaluator: "evaluate_asset_inventory" },
  },

  {
    controlId: "BL-DEV-03",
    title: "Device Encryption",
    description: "Managed devices have encryption (BitLocker/FileVault) enabled and enforced.",
    frameworkId: FW, family: "Device Security",
    evidenceQueries: [
      { id: "bl.dev.03-devices", description: "Managed devices with encryption status", endpoint: "/deviceManagement/managedDevices", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementManagedDevices.Read.All"], topN: 100, selectFields: ["id", "deviceName", "isEncrypted", "complianceState", "operatingSystem"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Managed devices have encryption enabled", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "BL-DEV-04",
    title: "OS Update Compliance",
    description: "Managed devices are running supported, up-to-date operating system versions.",
    frameworkId: FW, family: "Device Security",
    evidenceQueries: [
      { id: "bl.dev.04-devices", description: "Managed devices OS version info", endpoint: "/deviceManagement/managedDevices", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementManagedDevices.Read.All"], topN: 100, selectFields: ["id", "deviceName", "operatingSystem", "osVersion", "complianceState"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Devices are running current, supported OS versions", customEvaluator: "evaluate_device_compliance" },
  },

  // ===========================================================================
  // DATA PROTECTION — 4 controls
  // ===========================================================================

  {
    controlId: "BL-DAT-01",
    title: "Sensitivity Labels",
    description: "Microsoft Purview sensitivity labels are deployed to classify and protect sensitive data.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.01-labels", description: "Sensitivity labels configured in tenant", endpoint: "/security/informationProtection/sensitivityLabels", method: "GET", category: "sensitivityLabels", requiredPermissions: ["InformationProtectionPolicy.Read.All"], apiVersion: "beta" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Sensitivity labels are configured and published", customEvaluator: "evaluate_sensitivity_labels" },
  },

  {
    controlId: "BL-DAT-02",
    title: "Data Loss Prevention Policies",
    description: "DLP policies are configured to prevent sensitive data from leaving the organization.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.02-score", description: "Secure Score for DLP controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "DLP policies are active and covering key data types", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "BL-DAT-03",
    title: "External Sharing Restrictions",
    description: "SharePoint and OneDrive external sharing is restricted to approved domains or disabled.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.03-ca", description: "Conditional Access policies governing app access", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "bl.dat.03-score", description: "Secure Score for sharing controls", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "External sharing is restricted or governed by policies", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "BL-DAT-04",
    title: "Mail Transport Rules",
    description: "Exchange mail flow rules are configured to protect sensitive information in transit.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.04-score", description: "Secure Score for mail transport security", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Mail transport rules protect sensitive data in transit", customEvaluator: "evaluate_configuration_management" },
  },

  // ===========================================================================
  // MONITORING & LOGGING — 4 controls
  // ===========================================================================

  {
    controlId: "BL-MON-01",
    title: "Audit Logging",
    description: "Unified audit logging is enabled and capturing authentication and administrative events.",
    frameworkId: FW, family: "Monitoring & Logging",
    evidenceQueries: [
      { id: "bl.mon.01-signins", description: "Recent sign-in logs confirming audit capture", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10 },
      { id: "bl.mon.01-dir", description: "Directory audit logs", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit logs are actively capturing sign-in and directory events", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "BL-MON-02",
    title: "Security Alerts Configuration",
    description: "Security alerting is active for detecting suspicious sign-ins, risky users, and threats.",
    frameworkId: FW, family: "Monitoring & Logging",
    evidenceQueries: [
      { id: "bl.mon.02-alerts", description: "Active security alerts", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20, apiVersion: "beta" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security alerting is configured and operational", customEvaluator: "evaluate_security_monitoring" },
  },

  {
    controlId: "BL-MON-03",
    title: "Risky Sign-In Detection",
    description: "Azure AD Identity Protection detects and reports risky sign-in attempts.",
    frameworkId: FW, family: "Monitoring & Logging",
    evidenceQueries: [
      { id: "bl.mon.03-risky", description: "Risky sign-in detections", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Identity Protection is active and detecting risky sign-ins", customEvaluator: "evaluate_security_monitoring" },
  },

  {
    controlId: "BL-MON-04",
    title: "Microsoft Secure Score",
    description: "Organization's Microsoft Secure Score is tracked and demonstrates security posture awareness.",
    frameworkId: FW, family: "Monitoring & Logging",
    evidenceQueries: [
      { id: "bl.mon.04-score", description: "Current Secure Score", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Secure Score is available and being tracked", customEvaluator: "evaluate_risk_assessment" },
  },

  // ===========================================================================
  // CONFIGURATION MANAGEMENT — 3 controls
  // ===========================================================================

  {
    controlId: "BL-CFG-01",
    title: "Security Defaults or Conditional Access",
    description: "Tenant has either Security Defaults enabled or Conditional Access policies as a baseline security layer.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "bl.cfg.01-ca", description: "Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security Defaults or Conditional Access policies are active", customEvaluator: "evaluate_configuration_management" },
  },

  {
    controlId: "BL-CFG-02",
    title: "Anti-Phishing Protection",
    description: "Anti-phishing policies are configured to protect against impersonation and spoofing attacks.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "bl.cfg.02-score", description: "Secure Score for anti-phishing", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Anti-phishing policies are active and configured", customEvaluator: "evaluate_configuration_management" },
  },

  {
    controlId: "BL-CFG-03",
    title: "Password Policy",
    description: "Password policies enforce complexity requirements and banned password lists.",
    frameworkId: FW, family: "Configuration Management",
    evidenceQueries: [
      { id: "bl.cfg.03-org", description: "Organization password policies", endpoint: "/organization", method: "GET", category: "conditionalAccess", requiredPermissions: ["Organization.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Password policies enforce security requirements", customEvaluator: "evaluate_evidence_exists" },
  },
];
