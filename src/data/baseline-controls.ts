// =============================================================================
// Current State Baseline — Full M365 Tenant Inventory
//
// Pulls everything available from the connected Microsoft Graph API and reports
// on it. No opinions, no pass/fail judgments — just a raw data snapshot of the
// tenant's current security configuration and posture.
//
// Each control maps to a data area and collects everything the Graph permissions
// allow. The evaluate_evidence_exists evaluator simply confirms data was returned.
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";

const FW: FrameworkId = "BASELINE";

export const baselineControls: ComplianceControl[] = [

  // ===========================================================================
  // IDENTITY & ACCESS — 6 areas
  // ===========================================================================

  {
    controlId: "BL-IAM-01",
    title: "Conditional Access Policies",
    description: "Inventory of all Conditional Access policies configured in the tenant, including their state, conditions, and grant controls.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.01-ca", description: "All Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Conditional Access policies retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-IAM-02",
    title: "MFA Registration Status",
    description: "Authentication method registration details for all users — who has MFA registered, what methods they use, and registration gaps.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.02-reg", description: "User MFA registration details", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 999 },
      { id: "bl.iam.02-methods", description: "Authentication methods policy", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "MFA registration data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-IAM-03",
    title: "Directory Roles & Assignments",
    description: "All privileged role assignments and role definitions — who has what access, Global Admins count, and role scope.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.03-assign", description: "Directory role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
      { id: "bl.iam.03-defs", description: "Role definitions", endpoint: "/roleManagement/directory/roleDefinitions", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"], topN: 50 },
      { id: "bl.iam.03-elig", description: "PIM role eligibility schedules", endpoint: "/roleManagement/directory/roleEligibilitySchedules", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Directory role data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-IAM-04",
    title: "Guest & External Access",
    description: "Guest users in the directory, authorization policy settings for external collaboration, and invite restrictions.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.04-guests", description: "Guest users in directory", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], filterExpression: "userType eq 'Guest'", topN: 100 },
      { id: "bl.iam.04-authz", description: "Authorization policy (guest settings)", endpoint: "/policies/authorizationPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Guest access data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-IAM-05",
    title: "Authentication Methods Policy",
    description: "Tenant-wide authentication methods configuration — which methods are enabled, FIDO2, passwordless, SMS, etc.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.05-methods", description: "Authentication methods policy", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "bl.iam.05-strength", description: "Authentication strength policies", endpoint: "/policies/authenticationStrengthPolicies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Authentication methods policy retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-IAM-06",
    title: "Named Locations",
    description: "Trusted and named locations configured for Conditional Access — IP ranges, countries, and compliance boundaries.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "bl.iam.06-locs", description: "Named locations for Conditional Access", endpoint: "/identity/conditionalAccess/namedLocations", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Named locations data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // DEVICES & ENDPOINTS — 2 areas
  // ===========================================================================

  {
    controlId: "BL-DEV-01",
    title: "Device Compliance & Managed Devices",
    description: "Device compliance policies and inventory of all Intune-managed devices — compliance state, OS versions, encryption status.",
    frameworkId: FW, family: "Devices & Endpoints",
    evidenceQueries: [
      { id: "bl.dev.01-pol", description: "Device compliance policies", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "bl.dev.01-devices", description: "Managed devices inventory", endpoint: "/deviceManagement/managedDevices", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementManagedDevices.Read.All"], topN: 200 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device management data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-DEV-02",
    title: "Device Configuration Profiles",
    description: "Intune device configuration profiles — security baselines, restrictions, Wi-Fi, VPN, and other device settings.",
    frameworkId: FW, family: "Devices & Endpoints",
    evidenceQueries: [
      { id: "bl.dev.02-configs", description: "Device configuration profiles", endpoint: "/deviceManagement/deviceConfigurations", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device configuration data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // DATA PROTECTION — 2 areas
  // ===========================================================================

  {
    controlId: "BL-DAT-01",
    title: "Sensitivity Labels",
    description: "Microsoft Purview sensitivity labels configured in the tenant — classification taxonomy, auto-labeling rules, and protection settings.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.01-labels", description: "Sensitivity labels", endpoint: "/security/informationProtection/sensitivityLabels", method: "GET", category: "sensitivityLabels", requiredPermissions: ["InformationProtectionPolicy.Read.All"], apiVersion: "beta" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Sensitivity labels data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-DAT-02",
    title: "Secure Score — Data Protection",
    description: "Microsoft Secure Score data including current score, max score, and improvement actions for data protection controls.",
    frameworkId: FW, family: "Data Protection",
    evidenceQueries: [
      { id: "bl.dat.02-score", description: "Current Secure Score", endpoint: "/security/secureScores", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "bl.dat.02-profiles", description: "Secure Score control profiles", endpoint: "/security/secureScoreControlProfiles", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Secure Score data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // SECURITY POSTURE — 2 areas
  // ===========================================================================

  {
    controlId: "BL-SEC-01",
    title: "Security Alerts",
    description: "Active and recent security alerts from Microsoft Defender, Identity Protection, and other security services.",
    frameworkId: FW, family: "Security Posture",
    evidenceQueries: [
      { id: "bl.sec.01-alerts", description: "Security alerts (v2)", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 50, apiVersion: "beta" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security alerts data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "BL-SEC-02",
    title: "Identity Risk Detections",
    description: "Risky users flagged by Identity Protection and individual risk detection events — leaked credentials, impossible travel, etc.",
    frameworkId: FW, family: "Security Posture",
    evidenceQueries: [
      { id: "bl.sec.02-risky", description: "Risky users", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 50 },
      { id: "bl.sec.02-detections", description: "Risk detections", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Identity risk data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // AUDIT & MONITORING — 1 area
  // ===========================================================================

  {
    controlId: "BL-MON-01",
    title: "Audit & Sign-In Logs",
    description: "Recent sign-in activity and directory audit logs — authentication events, admin actions, and configuration changes.",
    frameworkId: FW, family: "Audit & Monitoring",
    evidenceQueries: [
      { id: "bl.mon.01-signins", description: "Recent sign-in logs", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 50 },
      { id: "bl.mon.01-dir", description: "Directory audit logs", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit log data retrieved from tenant", customEvaluator: "evaluate_evidence_exists" },
  },

  // ===========================================================================
  // TENANT CONFIGURATION — 1 area
  // ===========================================================================

  {
    controlId: "BL-CFG-01",
    title: "Tenant Configuration & Applications",
    description: "Organization settings, registered applications, and service principals — tenant-level configuration and app registrations.",
    frameworkId: FW, family: "Tenant Configuration",
    evidenceQueries: [
      { id: "bl.cfg.01-org", description: "Organization settings", endpoint: "/organization", method: "GET", category: "conditionalAccess", requiredPermissions: ["Organization.Read.All"] },
      { id: "bl.cfg.01-apps", description: "App registrations", endpoint: "/applications", method: "GET", category: "conditionalAccess", requiredPermissions: ["Application.Read.All"], topN: 100 },
      { id: "bl.cfg.01-sp", description: "Service principals", endpoint: "/servicePrincipals", method: "GET", category: "conditionalAccess", requiredPermissions: ["Application.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Tenant configuration data retrieved", customEvaluator: "evaluate_evidence_exists" },
  },
];
