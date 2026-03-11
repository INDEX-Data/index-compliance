// =============================================================================
// INDEX DSaaS - Constants
// =============================================================================

export const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
export const GRAPH_API_BETA = "https://graph.microsoft.com/beta";
export const CHARACTER_LIMIT = 50000;

// Required Graph API permissions by category
export const REQUIRED_PERMISSIONS: Record<string, string[]> = {
  conditionalAccess: ["Policy.Read.All"],
  sensitivityLabels: ["InformationProtection.Read.All"],
  dlpPolicies: ["InformationProtection.Read.All"],
  auditLog: ["AuditLog.Read.All"],
  deviceCompliance: ["DeviceManagementConfiguration.Read.All"],
  identityProtection: ["IdentityRiskyUser.Read.All", "IdentityRiskEvent.Read.All"],
  informationProtection: ["InformationProtection.Read.All"],
  retentionPolicies: ["RecordsManagement.Read.All"],
  encryptionPolicies: ["InformationProtection.Read.All"],
  roleAssignments: ["RoleManagement.Read.Directory"],
};

// Graph endpoints mapped to compliance evidence areas
export const GRAPH_ENDPOINTS = {
  conditionalAccessPolicies: "/identity/conditionalAccess/policies",
  sensitivityLabels: "/informationProtection/policy/labels",
  dlpPolicies: "/informationProtection/policy",
  auditLogs: "/auditLogs/signIns",
  directoryAuditLogs: "/auditLogs/directoryAudits",
  deviceCompliancePolicies: "/deviceManagement/deviceCompliancePolicies",
  deviceComplianceState: "/deviceManagement/managedDevices",
  identityProtectionRiskyUsers: "/identityProtection/riskyUsers",
  identityProtectionRiskDetections: "/identityProtection/riskDetections",
  retentionLabels: "/security/labels/retentionLabels",
  roleAssignments: "/roleManagement/directory/roleAssignments",
  roleDefinitions: "/roleManagement/directory/roleDefinitions",
  securityAlerts: "/security/alerts_v2",
  secureScore: "/security/secureScores",
  authenticationMethods: "/reports/authenticationMethods/userRegistrationDetails",
  mailboxSettings: "/users?$select=displayName,mailboxSettings",
  groups: "/groups",
  domains: "/domains",
} as const;
