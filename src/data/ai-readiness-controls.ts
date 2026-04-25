// =============================================================================
// AI Readiness Assessment — Data, Security & Compliance Readiness for AI
//
// Evaluates an organization's Microsoft 365 tenant to determine readiness for
// AI adoption (Copilot, third-party AI tools). Unlike the baseline inventory,
// this is opinionated — controls use specific evaluators that score pass/partial/fail
// to identify gaps that must be addressed before enabling AI.
//
// 18 controls across 6 families using existing evaluator functions.
// =============================================================================

import type { ComplianceControl, FrameworkId } from "../types.js";

const FW: FrameworkId = "AI_READINESS";

export const aiReadinessControls: ComplianceControl[] = [

  // ===========================================================================
  // DATA GOVERNANCE — 3 controls
  // AI systems process organizational data. Classification, DLP, and access
  // controls must be in place before AI amplifies data exposure risks.
  // ===========================================================================

  {
    controlId: "AI-DG-001",
    title: "Sensitivity Label Deployment",
    description: "Validates that sensitivity labels are deployed for data classification. AI tools like Copilot inherit document sensitivity — without labels, AI may surface or summarize sensitive content without appropriate protections.",
    frameworkId: FW, family: "Data Governance",
    evidenceQueries: [
      { id: "ai.dg001-score", description: "Secure Score (sensitivity label signals)", endpoint: "/security/secureScores", method: "GET", category: "informationProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "ai.dg001-audit", description: "Audit logs for label activity", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Sensitivity labels are deployed and actively used for data classification", customEvaluator: "evaluate_sensitivity_labels" },
  },

  {
    controlId: "AI-DG-002",
    title: "Data Loss Prevention Policies",
    description: "Checks for DLP policy deployment. DLP prevents AI from leaking sensitive data through prompts, generated content, or shared outputs. Without DLP, Copilot and third-party AI tools have no data exfiltration guardrails.",
    frameworkId: FW, family: "Data Governance",
    evidenceQueries: [
      { id: "ai.dg002-score", description: "Secure Score (DLP policy signals)", endpoint: "/security/secureScores", method: "GET", category: "dlpPolicies", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "ai.dg002-audit", description: "Audit logs for DLP activity", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "DLP policies are configured to prevent sensitive data exposure through AI tools", customEvaluator: "evaluate_dlp_policies" },
  },

  {
    controlId: "AI-DG-003",
    title: "Guest & External Data Access Controls",
    description: "Evaluates guest user access and external collaboration policies. AI tools may surface data to external collaborators — guest access must be controlled before AI amplifies oversharing risks.",
    frameworkId: FW, family: "Data Governance",
    evidenceQueries: [
      { id: "ai.dg003-guests", description: "Guest users in directory", endpoint: "/users", method: "GET", category: "identityProtection", requiredPermissions: ["User.Read.All"], filterExpression: "userType eq 'Guest'", topN: 100 },
      { id: "ai.dg003-authz", description: "Authorization policy (guest settings)", endpoint: "/policies/authorizationPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Guest and external access is appropriately restricted for AI data protection", customEvaluator: "evaluate_guest_access" },
  },

  // ===========================================================================
  // IDENTITY & ACCESS — 4 controls
  // AI services are high-value targets. Strong identity controls prevent
  // compromised accounts from accessing AI-powered data at scale.
  // ===========================================================================

  {
    controlId: "AI-IA-001",
    title: "MFA Enforcement via Conditional Access",
    description: "Validates that MFA is enforced through Conditional Access policies. Compromised identities with AI access can exfiltrate data at scale — MFA is the minimum identity security bar for AI readiness.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "ai.ia001-ca", description: "Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "MFA is enforced via Conditional Access policies for all users accessing AI services", customEvaluator: "evaluate_mfa_enforcement" },
  },

  {
    controlId: "AI-IA-002",
    title: "MFA Registration Coverage",
    description: "Measures the percentage of users registered for MFA. Even with MFA policies enabled, registration gaps leave users unprotected. AI readiness requires organization-wide strong authentication coverage.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "ai.ia002-reg", description: "User MFA registration details", endpoint: "/reports/authenticationMethods/userRegistrationDetails", method: "GET", category: "identityProtection", requiredPermissions: ["UserAuthenticationMethod.Read.All"], topN: 100 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "MFA registration coverage exceeds 90% of all users", customEvaluator: "evaluate_mfa_coverage" },
  },

  {
    controlId: "AI-IA-003",
    title: "Privileged Access Controls (RBAC)",
    description: "Analyzes privileged role assignments for least-privilege compliance. AI admin roles (AI Administrator, Copilot Administrator) must follow RBAC best practices. Excessive Global Admins can misconfigure AI policies organization-wide.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "ai.ia003-roles", description: "Directory role assignments", endpoint: "/roleManagement/directory/roleAssignments", method: "GET", category: "roleAssignments", requiredPermissions: ["RoleManagement.Read.Directory"], expandFields: ["roleDefinition"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Privileged access follows least-privilege with no more than 5 Global Administrators", customEvaluator: "evaluate_rbac" },
  },

  {
    controlId: "AI-IA-004",
    title: "Conditional Access Policy Coverage",
    description: "Verifies comprehensive Conditional Access policy coverage including named locations and authentication methods. AI should be gated by CA policies that restrict access by location, device compliance, and authentication strength.",
    frameworkId: FW, family: "Identity & Access",
    evidenceQueries: [
      { id: "ai.ia004-ca", description: "Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ai.ia004-loc", description: "Named locations", endpoint: "/identity/conditionalAccess/namedLocations", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ai.ia004-auth", description: "Authentication methods policy", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Conditional Access policies, named locations, and authentication methods are configured", customEvaluator: "evaluate_policy_exists" },
  },

  // ===========================================================================
  // DEVICE & ENDPOINT SECURITY — 2 controls
  // AI tools accessed from non-compliant or unmanaged devices create data
  // leakage vectors. Endpoint security is a prerequisite for AI deployment.
  // ===========================================================================

  {
    controlId: "AI-DE-001",
    title: "Device Compliance Policies",
    description: "Validates that device compliance policies are deployed. AI tools accessed from non-compliant devices (unencrypted, jailbroken, outdated OS) create data leakage vectors that AI amplifies.",
    frameworkId: FW, family: "Device & Endpoint Security",
    evidenceQueries: [
      { id: "ai.de001-policies", description: "Device compliance policies", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance policies are deployed to enforce security baselines", customEvaluator: "evaluate_device_compliance" },
  },

  {
    controlId: "AI-DE-002",
    title: "Endpoint Configuration Management",
    description: "Checks device compliance policies and configuration profiles. Security baselines must be deployed before AI tools are rolled out — misconfigured endpoints are attack vectors for AI-generated phishing and data exfiltration.",
    frameworkId: FW, family: "Device & Endpoint Security",
    evidenceQueries: [
      { id: "ai.de002-compliance", description: "Device compliance policies", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ai.de002-configs", description: "Device configuration profiles", endpoint: "/deviceManagement/deviceConfigurations", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Device compliance and configuration policies are actively managed", customEvaluator: "evaluate_configuration_management" },
  },

  // ===========================================================================
  // SECURITY POSTURE — 3 controls
  // AI increases the attack surface. Organizations must demonstrate active
  // security monitoring and threat detection before adding AI capabilities.
  // ===========================================================================

  {
    controlId: "AI-SP-001",
    title: "Risk Assessment & Secure Score",
    description: "Evaluates overall security posture through Microsoft Secure Score, risk detections, and risky user signals. AI increases attack surface — organizations must demonstrate they are actively monitoring and improving security before enabling AI.",
    frameworkId: FW, family: "Security Posture",
    evidenceQueries: [
      { id: "ai.sp001-score", description: "Microsoft Secure Score", endpoint: "/security/secureScores", method: "GET", category: "informationProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 1 },
      { id: "ai.sp001-profiles", description: "Secure Score control profiles", endpoint: "/security/secureScoreControlProfiles", method: "GET", category: "informationProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20 },
      { id: "ai.sp001-detections", description: "Identity risk detections", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20 },
      { id: "ai.sp001-risky", description: "Risky users", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Security posture is actively managed with acceptable Secure Score and controlled risk exposure", customEvaluator: "evaluate_risk_assessment" },
  },

  {
    controlId: "AI-SP-002",
    title: "Security Monitoring & Threat Detection",
    description: "Assesses active threat monitoring capabilities including security alerts, risk events, and sign-in anomaly detection. AI-generated threats (sophisticated phishing, automated attacks) require active monitoring — unmonitored environments cannot detect AI-specific threats.",
    frameworkId: FW, family: "Security Posture",
    evidenceQueries: [
      { id: "ai.sp002-alerts", description: "Security alerts", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 20, apiVersion: "beta" },
      { id: "ai.sp002-detections", description: "Identity risk detections", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20 },
      { id: "ai.sp002-risky", description: "Risky users", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 10 },
      { id: "ai.sp002-signins", description: "Recent sign-in logs", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Active security monitoring and threat detection are operational", customEvaluator: "evaluate_security_monitoring" },
  },

  {
    controlId: "AI-SP-003",
    title: "Application & Service Principal Inventory",
    description: "Inventories registered applications and service principals. AI tools register as applications with tenant access — organizations must have visibility into which apps have access before enabling AI. Shadow AI is a governance risk.",
    frameworkId: FW, family: "Security Posture",
    evidenceQueries: [
      { id: "ai.sp003-apps", description: "Registered applications", endpoint: "/applications", method: "GET", category: "roleAssignments", requiredPermissions: ["Application.Read.All"], topN: 50 },
      { id: "ai.sp003-sps", description: "Service principals", endpoint: "/servicePrincipals", method: "GET", category: "roleAssignments", requiredPermissions: ["Application.Read.All"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Application and service principal inventory is visible and managed", customEvaluator: "evaluate_asset_inventory" },
  },

  // ===========================================================================
  // AUDIT & MONITORING — 2 controls
  // AI decisions must be auditable. Active logging provides the trail needed
  // for AI governance, incident response, and regulatory compliance.
  // ===========================================================================

  {
    controlId: "AI-AM-001",
    title: "Audit Logging Active",
    description: "Confirms that audit logging is active and capturing directory events. AI decisions and data access must be auditable — without active logging, there is no trail for AI actions, configuration changes, or data access patterns.",
    frameworkId: FW, family: "Audit & Monitoring",
    evidenceQueries: [
      { id: "ai.am001-audits", description: "Directory audit logs", endpoint: "/auditLogs/directoryAudits", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 10 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Audit logging is active with recent directory audit entries", customEvaluator: "evaluate_audit_logging" },
  },

  {
    controlId: "AI-AM-002",
    title: "Sign-In Activity Monitoring",
    description: "Evaluates sign-in monitoring and anomaly detection capabilities. Monitoring sign-in patterns detects anomalous AI tool usage, compromised accounts accessing AI, and unusual data access volumes.",
    frameworkId: FW, family: "Audit & Monitoring",
    evidenceQueries: [
      { id: "ai.am002-signins", description: "Recent sign-in logs", endpoint: "/auditLogs/signIns", method: "GET", category: "auditLog", requiredPermissions: ["AuditLog.Read.All"], topN: 20 },
      { id: "ai.am002-detections", description: "Identity risk detections", endpoint: "/identityProtection/riskDetections", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskEvent.Read.All"], topN: 20 },
      { id: "ai.am002-risky", description: "Risky users", endpoint: "/identityProtection/riskyUsers", method: "GET", category: "identityProtection", requiredPermissions: ["IdentityRiskyUser.Read.All"], topN: 10 },
      { id: "ai.am002-alerts", description: "Security alerts", endpoint: "/security/alerts_v2", method: "GET", category: "identityProtection", requiredPermissions: ["SecurityEvents.Read.All"], topN: 10, apiVersion: "beta" },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Sign-in activity is monitored with anomaly detection operational", customEvaluator: "evaluate_security_monitoring" },
  },

  // ===========================================================================
  // COMPLIANCE READINESS — 4 controls
  // AI has emerging regulatory requirements. Organizations must have governance
  // foundations in place before AI introduces new compliance obligations.
  // ===========================================================================

  {
    controlId: "AI-CR-001",
    title: "Managed Device Inventory",
    description: "Validates that a device inventory exists via Intune. AI governance requires knowing which devices can access AI tools — unmanaged device blind spots mean uncontrolled AI access and potential data leakage.",
    frameworkId: FW, family: "Compliance Readiness",
    evidenceQueries: [
      { id: "ai.cr001-devices", description: "Managed devices", endpoint: "/deviceManagement/managedDevices", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementManagedDevices.Read.All"], topN: 50 },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Managed device inventory exists with actively enrolled devices", customEvaluator: "evaluate_asset_inventory" },
  },

  {
    controlId: "AI-CR-002",
    title: "Organization Metadata & Licensing",
    description: "Confirms tenant is accessible and organization metadata is retrievable. This foundational check verifies the Graph API connection and tenant configuration that all other AI readiness controls depend on.",
    frameworkId: FW, family: "Compliance Readiness",
    evidenceQueries: [
      { id: "ai.cr002-org", description: "Organization settings", endpoint: "/organization", method: "GET", category: "conditionalAccess", requiredPermissions: ["Organization.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Organization metadata and licensing information retrieved successfully", customEvaluator: "evaluate_evidence_exists" },
  },

  {
    controlId: "AI-CR-003",
    title: "Authentication Methods Policy",
    description: "Verifies authentication methods and authorization policies are configured. AI access must be governed by strong authentication policies — weak auth methods create pathways for unauthorized AI usage and data access.",
    frameworkId: FW, family: "Compliance Readiness",
    evidenceQueries: [
      { id: "ai.cr003-methods", description: "Authentication methods policy", endpoint: "/policies/authenticationMethodsPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ai.cr003-authz", description: "Authorization policy", endpoint: "/policies/authorizationPolicy", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Authentication and authorization policies are configured for secure AI access", customEvaluator: "evaluate_policy_exists" },
  },

  {
    controlId: "AI-CR-004",
    title: "Security Governance Policies",
    description: "Evaluates comprehensive policy coverage across Conditional Access, device compliance, and device configuration. This governance foundation is essential for responsible AI deployment — policy gaps create uncontrolled AI access paths.",
    frameworkId: FW, family: "Compliance Readiness",
    evidenceQueries: [
      { id: "ai.cr004-ca", description: "Conditional Access policies", endpoint: "/identity/conditionalAccess/policies", method: "GET", category: "conditionalAccess", requiredPermissions: ["Policy.Read.All"] },
      { id: "ai.cr004-compliance", description: "Device compliance policies", endpoint: "/deviceManagement/deviceCompliancePolicies", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
      { id: "ai.cr004-configs", description: "Device configuration profiles", endpoint: "/deviceManagement/deviceConfigurations", method: "GET", category: "deviceCompliance", requiredPermissions: ["DeviceManagementConfiguration.Read.All"] },
    ],
    evaluationCriteria: { type: "custom", passingCondition: "Comprehensive security governance policies are deployed across CA, device compliance, and configuration", customEvaluator: "evaluate_policy_exists" },
  },

];
