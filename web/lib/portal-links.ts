/**
 * Azure / Microsoft 365 admin portal deep links keyed by control ID.
 * Controls can have multiple remediation destinations.
 * Used in ControlCard to show direct "Fix in Azure" links.
 */

export interface PortalLink {
  label: string
  url:   string
  /** Short description of what this page controls */
  hint?: string
}

const LINKS: Record<string, PortalLink[]> = {

  // ─── NIST CSF 2.0 — Govern ────────────────────────────────────────────────
  'GV.RM-01': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore',                              hint: 'View & improve overall security posture' },
    { label: 'Security Defaults',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Properties', hint: 'Enable security baseline' },
  ],
  'GV.RM-02': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore' },
  ],
  'GV.OC-01': [
    { label: 'Tenant Properties',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview' },
  ],
  'GV.OC-03': [
    { label: 'Compliance Center',  url: 'https://compliance.microsoft.com/',                                       hint: 'Manage compliance policies' },
  ],
  'GV.RR-02': [
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles', hint: 'Review assigned admin roles' },
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade', hint: 'Privileged Identity Management' },
  ],
  'GV.PO-01': [
    { label: 'Compliance Center',  url: 'https://compliance.microsoft.com/' },
  ],
  'GV.OV-01': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore' },
    { label: 'Compliance Center',  url: 'https://compliance.microsoft.com/' },
  ],

  // ─── NIST CSF 2.0 — Identify ──────────────────────────────────────────────
  'ID.AM-01': [
    { label: 'Entra Devices',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_Devices/DevicesMenuBlade/~/AllDevices', hint: 'Inventory of registered devices' },
  ],
  'ID.AM-02': [
    { label: 'Enterprise Apps',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps', hint: 'Inventory of applications' },
  ],
  'ID.AM-03': [
    { label: 'Named Locations',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/NamedLocationsMenuBlade',           hint: 'Network location inventory' },
  ],
  'ID.AM-04': [
    { label: 'External Services',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps' },
  ],
  'ID.AM-05': [
    { label: 'Guest Users',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/GuestUsers', hint: 'Manage guest and external users' },
    { label: 'External Identities',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ExternalIdentitiesMenuBlade/~/Overview', hint: 'Guest invitation settings' },
  ],
  'ID.AM-07': [
    { label: 'Information Protection', url: 'https://compliance.microsoft.com/informationprotection', hint: 'Sensitivity labels & data classification' },
  ],
  'ID.AM-08': [
    { label: 'All Users',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/AllUsers', hint: 'Manage user lifecycle' },
    { label: 'Access Reviews',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_ERM/DashboardBlade',                hint: 'Periodic access review campaigns' },
  ],
  'ID.RA-01': [
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Risk detection & remediation' },
  ],
  'ID.RA-02': [
    { label: 'Defender XDR',       url: 'https://security.microsoft.com/homepage', hint: 'Threat intelligence feeds' },
  ],
  'ID.RA-03': [
    { label: 'Risky Sign-ins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskySignIns' },
  ],
  'ID.RA-05': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore' },
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview' },
  ],
  'ID.IM-01': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore', hint: 'Improvement actions' },
  ],

  // ─── NIST CSF 2.0 — Protect ───────────────────────────────────────────────
  'PR.AA-01': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Configure MFA & auth methods' },
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies', hint: 'Require MFA via CA policy' },
  ],
  'PR.AA-02': [
    { label: 'Identity Verification', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/UsersMenuBlade', hint: 'Manage identity proofing' },
  ],
  'PR.AA-03': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies', hint: 'Identity-based access control' },
    { label: 'Named Locations',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/NamedLocationsMenuBlade' },
  ],
  'PR.AA-04': [
    { label: 'Passwordless Setup', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'FIDO2 / Windows Hello configuration' },
  ],
  'PR.AA-05': [
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles', hint: 'Least-privilege role assignments' },
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade' },
  ],
  'PR.AA-06': [
    { label: 'Intune Devices',     url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/overview', hint: 'Physical device access controls' },
  ],
  'PR.AT-01': [
    { label: 'Microsoft 365 Admin', url: 'https://admin.microsoft.com/', hint: 'Security training & awareness' },
  ],
  'PR.DS-01': [
    { label: 'Info Protection',    url: 'https://compliance.microsoft.com/informationprotection', hint: 'Data-at-rest encryption labels' },
  ],
  'PR.DS-02': [
    { label: 'DLP Policies',       url: 'https://compliance.microsoft.com/datalossprevention',                    hint: 'Data in transit protection' },
  ],
  'PR.DS-10': [
    { label: 'Info Protection',    url: 'https://compliance.microsoft.com/informationprotection' },
  ],
  'PR.PS-01': [
    { label: 'Intune Policies',    url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Device configuration baseline' },
  ],
  'PR.PS-02': [
    { label: 'Intune Updates',     url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/softwareUpdates', hint: 'Patch management policies' },
  ],
  'PR.PS-04': [
    { label: 'Diagnostic Settings',url: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/DiagnosticSettings', hint: 'Log forwarding configuration' },
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit' },
  ],
  'PR.PS-05': [
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade', hint: 'Privileged access management' },
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  'PR.IR-01': [
    { label: 'Backup Center',      url: 'https://portal.azure.com/#view/Microsoft_RecoveryServices/BackupCenterBlade', hint: 'Data backup & resilience' },
  ],

  // ─── NIST CSF 2.0 — Detect ────────────────────────────────────────────────
  'DE.CM-01': [
    { label: 'Sign-in Logs',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns',   hint: 'Monitor authentication activity' },
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit' },
  ],
  'DE.CM-02': [
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview' },
  ],
  'DE.CM-03': [
    { label: 'Risky Users',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers', hint: 'Users flagged at risk' },
  ],
  'DE.CM-06': [
    { label: 'Defender for Cloud Apps', url: 'https://security.microsoft.com/cloudapps/app-governance', hint: 'SaaS app monitoring' },
  ],
  'DE.CM-09': [
    { label: 'Defender XDR',       url: 'https://security.microsoft.com/homepage', hint: 'Integrated security monitoring' },
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore' },
  ],
  'DE.AE-02': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents', hint: 'Investigate anomalies & events' },
    { label: 'Alerts',             url: 'https://security.microsoft.com/alerts' },
  ],
  'DE.AE-04': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents', hint: 'Estimate impact of security events' },
  ],

  // ─── NIST CSF 2.0 — Respond ───────────────────────────────────────────────
  'RS.MA-01': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents', hint: 'Manage active incidents' },
  ],
  'RS.MA-02': [
    { label: 'Alerts',             url: 'https://security.microsoft.com/alerts', hint: 'Security alert reporting' },
  ],
  'RS.AN-01': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents' },
    { label: 'Advanced Hunting',   url: 'https://security.microsoft.com/v2/advanced-hunting', hint: 'Threat investigation queries' },
  ],
  'RS.AN-03': [
    { label: 'Advanced Hunting',   url: 'https://security.microsoft.com/v2/advanced-hunting' },
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents' },
  ],
  'RS.CO-01': [
    { label: 'Service Health',     url: 'https://admin.microsoft.com/AdminPortal/Home#/servicehealth', hint: 'Incident communication status' },
  ],
  'RS.MI-01': [
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Containment & mitigation actions' },
    { label: 'Risky Users',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers' },
  ],
  'RS.MI-02': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies', hint: 'Block compromised accounts' },
  ],

  // ─── NIST CSF 2.0 — Recover ───────────────────────────────────────────────
  'RC.RP-01': [
    { label: 'Backup Center',      url: 'https://portal.azure.com/#view/Microsoft_RecoveryServices/BackupCenterBlade', hint: 'Recovery plan & backups' },
  ],
  'RC.RP-03': [
    { label: 'Backup Center',      url: 'https://portal.azure.com/#view/Microsoft_RecoveryServices/BackupCenterBlade' },
  ],
  'RC.RP-05': [
    { label: 'Service Health',     url: 'https://admin.microsoft.com/AdminPortal/Home#/servicehealth' },
  ],
  'RC.CO-03': [
    { label: 'Service Health',     url: 'https://admin.microsoft.com/AdminPortal/Home#/servicehealth', hint: 'Post-incident communication' },
  ],

  // ─── NIST SP 800-171 r2 / Access Control (3.1) ───────────────────────────
  // These IDs also resolve for CMMC L2 via the fallback in getPortalLinks()
  '3.1.1': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',   hint: 'Restrict access to authorized users & devices' },
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  '3.1.2': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',   hint: 'Limit transactions by role and app' },
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  '3.1.3': [
    { label: 'Info Protection',    url: 'https://compliance.microsoft.com/informationprotection',  hint: 'Sensitivity labels to control CUI flow' },
    { label: 'DLP Policies',       url: 'https://compliance.microsoft.com/datalossprevention' },
  ],
  '3.1.4': [
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',          hint: 'Separate administrative duties' },
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  '3.1.5': [
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',          hint: 'Least privilege & just-in-time access' },
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  '3.1.6': [
    { label: 'Roles & Admins',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles',           hint: 'Enforce non-privileged accounts for non-security tasks' },
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade' },
  ],
  '3.1.7': [
    { label: 'PIM',                url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',          hint: 'Restrict privileged function use' },
  ],
  '3.1.12': [
    { label: 'Sign-in Logs',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns',   hint: 'Monitor remote access sessions' },
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies' },
  ],
  '3.1.13': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',   hint: 'Employ cryptographic mechanisms for remote access' },
  ],
  '3.1.14': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',   hint: 'Route remote access via managed access control points' },
  ],
  '3.1.20': [
    { label: 'Named Locations',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/NamedLocationsMenuBlade',              hint: 'Verify and authorize external connections' },
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies' },
  ],

  // ─── NIST SP 800-171 r2 / Audit and Accountability (3.3) ─────────────────
  '3.3.1': [
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',     hint: 'Create and retain audit logs' },
    { label: 'Sign-in Logs',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns' },
  ],
  '3.3.2': [
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',     hint: 'Ensure user actions are traceable' },
  ],
  '3.3.3': [
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',     hint: 'Review and update logged events' },
  ],
  '3.3.5': [
    { label: 'Diagnostic Settings',url: 'https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/DiagnosticSettings', hint: 'Correlate audit records from multiple sources' },
  ],

  // ─── NIST SP 800-171 r2 / Configuration Management (3.4) ─────────────────
  '3.4.1': [
    { label: 'Intune Config',      url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/configurationProfiles', hint: 'Establish baseline configurations' },
  ],
  '3.4.2': [
    { label: 'Intune Config',      url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/configurationProfiles', hint: 'Enforce security configuration settings' },
    { label: 'Intune Compliance',  url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu' },
  ],
  '3.4.6': [
    { label: 'Intune Apps',        url: 'https://intune.microsoft.com/#view/Microsoft_Intune_Apps/MainMenu/~/overview',              hint: 'Apply least functionality principle' },
  ],
  '3.4.7': [
    { label: 'Intune Apps',        url: 'https://intune.microsoft.com/#view/Microsoft_Intune_Apps/MainMenu/~/overview',              hint: 'Restrict, disable, or prevent nonessential programs' },
  ],
  '3.4.9': [
    { label: 'Enterprise Apps',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps', hint: 'Control user-installed software' },
  ],

  // ─── NIST SP 800-171 r2 / Identification and Authentication (3.5) ─────────
  '3.5.1': [
    { label: 'All Users',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/AllUsers', hint: 'Identify system users, processes, and devices' },
  ],
  '3.5.2': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Authenticate users, processes, and devices' },
  ],
  '3.5.3': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Use MFA for local and network access' },
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies' },
  ],
  '3.5.4': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Employ replay-resistant authentication' },
  ],
  '3.5.5': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Prohibit password reuse' },
  ],
  '3.5.7': [
    { label: 'Auth Methods',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Enforce minimum password complexity' },
  ],

  // ─── NIST SP 800-171 r2 / Incident Response (3.6) ────────────────────────
  '3.6.1': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents',                                                  hint: 'Establish incident handling capability' },
    { label: 'Alerts',             url: 'https://security.microsoft.com/alerts' },
  ],
  '3.6.2': [
    { label: 'Incidents',          url: 'https://security.microsoft.com/incidents',                                                  hint: 'Track, document, and report incidents' },
  ],

  // ─── NIST SP 800-171 r2 / Risk Assessment (3.11) ─────────────────────────
  '3.11.1': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore',                                               hint: 'Periodically assess organizational risk' },
    { label: 'Defender for Cloud', url: 'https://portal.azure.com/#view/Microsoft_Azure_Security/SecurityMenuBlade/~/Overview' },
  ],
  '3.11.2': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore',                                               hint: 'Scan for vulnerabilities periodically' },
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview' },
  ],
  '3.11.3': [
    { label: 'Secure Score',       url: 'https://security.microsoft.com/securescore',                                               hint: 'Remediate identified vulnerabilities' },
  ],

  // ─── NIST SP 800-171 r2 / System and Comms Protection (3.13) ─────────────
  '3.13.1': [
    { label: 'Conditional Access', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',   hint: 'Monitor, control, and protect communications at boundaries' },
    { label: 'Named Locations',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/NamedLocationsMenuBlade' },
  ],
  '3.13.5': [
    { label: 'DLP Policies',       url: 'https://compliance.microsoft.com/datalossprevention',                                      hint: 'Implement subnetworks for publicly accessible system components' },
  ],
  '3.13.13': [
    { label: 'Enterprise Apps',    url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps', hint: 'Control and monitor mobile code' },
  ],
  '3.13.16': [
    { label: 'Info Protection',    url: 'https://compliance.microsoft.com/informationprotection',                                   hint: 'Protect CUI at rest' },
  ],

  // ─── NIST SP 800-171 r2 / System and Information Integrity (3.14) ─────────
  '3.14.1': [
    { label: 'Defender XDR',       url: 'https://security.microsoft.com/homepage',                                                  hint: 'Identify and manage information system flaws' },
  ],
  '3.14.2': [
    { label: 'Defender XDR',       url: 'https://security.microsoft.com/homepage',                                                  hint: 'Provide protection from malicious code' },
  ],
  '3.14.6': [
    { label: 'Audit Logs',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',     hint: 'Monitor information systems for attacks' },
    { label: 'Sign-in Logs',       url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns' },
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview' },
  ],
  '3.14.7': [
    { label: 'Identity Protection',url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Identify unauthorized use of systems' },
    { label: 'Risky Users',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers' },
  ],

  // ─── HIPAA Security Rule — Administrative Safeguards (§ 164.308) ──────────
  '164.308(a)(1)(i)': [
    { label: 'Secure Score',        url: 'https://security.microsoft.com/securescore',                                                 hint: 'View risk posture for HIPAA risk analysis' },
    { label: 'Identity Protection', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Identify identity-based risks to ePHI' },
  ],
  '164.308(a)(1)(ii)(B)': [
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Enforce risk management controls' },
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Device compliance as risk mitigation' },
  ],
  '164.308(a)(2)': [
    { label: 'Roles & Admins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles',             hint: 'Assign and verify Security/Compliance Admin roles' },
    { label: 'PIM',                 url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',           hint: 'Privileged role assignments for security officer' },
  ],
  '164.308(a)(3)(ii)(A)': [
    { label: 'Roles & Admins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles',             hint: 'Review workforce access authorization' },
    { label: 'Access Reviews',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_ERM/DashboardBlade',                        hint: 'Periodic workforce access review campaigns' },
  ],
  '164.308(a)(3)(ii)(C)': [
    { label: 'All Users',           url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/AllUsers', hint: 'Disable/delete terminated user accounts' },
    { label: 'Audit Logs',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',      hint: 'Verify user termination audit trail' },
  ],
  '164.308(a)(4)(ii)(B)': [
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Access authorization policies for ePHI systems' },
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Configure strong authentication' },
  ],
  '164.308(a)(5)(ii)(B)': [
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Require antivirus on ePHI endpoints' },
    { label: 'Defender XDR',        url: 'https://security.microsoft.com/homepage',                                                   hint: 'Monitor for malware detections' },
  ],
  '164.308(a)(5)(ii)(C)': [
    { label: 'Sign-in Logs',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns',    hint: 'Monitor failed login attempts to ePHI systems' },
    { label: 'Risky Sign-ins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskySignIns', hint: 'Review anomalous sign-in activity' },
  ],
  '164.308(a)(5)(ii)(D)': [
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Configure MFA / passwordless (replaces weak passwords)' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Enforce password/MFA policies at sign-in' },
  ],
  '164.308(a)(6)(i)': [
    { label: 'Incidents',           url: 'https://security.microsoft.com/incidents',                                                   hint: 'Security incident management for HIPAA breaches' },
    { label: 'Risky Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers', hint: 'Remediate identity-based security incidents' },
  ],
  '164.308(a)(7)(ii)(A)': [
    { label: 'Backup Center',       url: 'https://portal.azure.com/#view/Microsoft_RecoveryServices/BackupCenterBlade',               hint: 'Configure ePHI data backup policies' },
    { label: 'Compliance Center',   url: 'https://compliance.microsoft.com/informationprotectionretention',                            hint: 'Retention policies for M365 ePHI data' },
  ],
  '164.308(a)(8)': [
    { label: 'Secure Score',        url: 'https://security.microsoft.com/securescore',                                                 hint: 'Ongoing HIPAA security evaluation via posture scoring' },
    { label: 'Compliance Manager',  url: 'https://compliance.microsoft.com/compliancemanager',                                        hint: 'HIPAA compliance assessment and evaluation' },
  ],

  // ─── HIPAA Security Rule — Physical Safeguards (§ 164.310) ───────────────
  '164.310(a)(1)': [
    { label: 'Intune Devices',      url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/overview', hint: 'Manage devices accessing ePHI' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Require compliant device for ePHI access' },
  ],
  '164.310(b)': [
    { label: 'Intune Config',       url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/configurationProfiles', hint: 'Workstation use policies via configuration profiles' },
  ],
  '164.310(c)': [
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Workstation security: encryption, screen lock, passcode' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Block non-compliant workstations from ePHI access' },
  ],
  '164.310(d)(1)': [
    { label: 'Intune Config',       url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesMenu/~/configurationProfiles', hint: 'Restrict removable media and USB on ePHI workstations' },
    { label: 'DLP Policies',        url: 'https://compliance.microsoft.com/datalossprevention',                                        hint: 'Prevent ePHI export via DLP rules' },
  ],

  // ─── HIPAA Security Rule — Technical Safeguards (§ 164.312) ─────────────
  '164.312(a)(1)': [
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Technical access control for ePHI systems' },
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Configure unique user identification (MFA)' },
  ],
  '164.312(b)': [
    { label: 'Audit Logs',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',      hint: 'ePHI system activity audit logs' },
    { label: 'Sign-in Logs',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/SignIns',    hint: 'ePHI access logs for HIPAA audit controls' },
    { label: 'Compliance Center',   url: 'https://compliance.microsoft.com/auditlogsearch',                                           hint: 'Unified audit log search for M365 ePHI activity' },
  ],
  '164.312(c)(1)': [
    { label: 'Info Protection',     url: 'https://compliance.microsoft.com/informationprotection',                                    hint: 'Sensitivity labels to protect ePHI integrity' },
    { label: 'DLP Policies',        url: 'https://compliance.microsoft.com/datalossprevention',                                       hint: 'DLP policies prevent improper ePHI modification' },
  ],
  '164.312(d)': [
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'MFA / passwordless for HIPAA authentication' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Enforce MFA for all ePHI access' },
  ],
  '164.312(e)(1)': [
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Require compliant devices for secure ePHI transmission' },
    { label: 'DLP Policies',        url: 'https://compliance.microsoft.com/datalossprevention',                                       hint: 'Prevent unauthorized ePHI transmission' },
  ],

  // ─── HIPAA Organizational Requirements (§ 164.314) ─────────────────────
  '164.314(a)(1)': [
    { label: 'Guest Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/GuestUsers', hint: 'Review business associate external accounts' },
    { label: 'External Identities', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ExternalIdentitiesMenuBlade/~/Overview', hint: 'Configure guest invitation policies for BAs' },
  ],

  // ─── FINRA Cybersecurity — Governance & Risk Management ─────────────────
  'FINRA-GOV-1': [
    { label: 'Secure Score',        url: 'https://security.microsoft.com/securescore',                                                 hint: 'Governance posture for broker-dealer cybersecurity program' },
    { label: 'Compliance Manager',  url: 'https://compliance.microsoft.com/compliancemanager',                                        hint: 'FINRA compliance management and tracking' },
  ],
  'FINRA-GOV-2': [
    { label: 'Secure Score',        url: 'https://security.microsoft.com/securescore',                                                 hint: 'Annual cybersecurity risk assessment via posture scoring' },
    { label: 'Identity Protection', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Identity risk findings for annual risk assessment' },
  ],
  'FINRA-GOV-3': [
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Written security policies operationalized in CA' },
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Endpoint security policy baseline' },
  ],

  // ─── FINRA Cybersecurity — Access Controls & Identity Management ─────────
  'FINRA-ACC-1': [
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'Configure MFA for all broker-dealer staff' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Enforce MFA policy for all sign-ins' },
  ],
  'FINRA-ACC-2': [
    { label: 'PIM',                 url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',           hint: 'Privileged Identity Management for admin access' },
    { label: 'Roles & Admins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles',             hint: 'Review and minimize privileged role assignments' },
  ],
  'FINRA-ACC-3': [
    { label: 'Access Reviews',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_ERM/DashboardBlade',                        hint: 'Periodic access reviews for FINRA compliance' },
    { label: 'Guest Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/GuestUsers', hint: 'Review external user access' },
  ],

  // ─── FINRA Cybersecurity — Data Classification & Loss Prevention ─────────
  'FINRA-DATA-1': [
    { label: 'Info Protection',     url: 'https://compliance.microsoft.com/informationprotection',                                    hint: 'Sensitivity labels for customer NPI classification' },
  ],
  'FINRA-DATA-2': [
    { label: 'DLP Policies',        url: 'https://compliance.microsoft.com/datalossprevention',                                       hint: 'DLP policies for Reg S-P customer data protection' },
  ],
  'FINRA-DATA-3': [
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Require BitLocker encryption on broker-dealer devices' },
  ],

  // ─── FINRA Cybersecurity — Vendor & Third-Party Management ──────────────
  'FINRA-VND-1': [
    { label: 'Enterprise Apps',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps', hint: 'Inventory of vendor application integrations' },
  ],
  'FINRA-VND-2': [
    { label: 'External Identities', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ExternalIdentitiesMenuBlade/~/Overview', hint: 'Control vendor external access to firm systems' },
    { label: 'Guest Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/GuestUsers' },
  ],

  // ─── FINRA Cybersecurity — Security Monitoring & Incident Response ───────
  'FINRA-MON-1': [
    { label: 'Defender XDR',        url: 'https://security.microsoft.com/homepage',                                                   hint: 'Continuous security monitoring for FINRA compliance' },
    { label: 'Incidents',           url: 'https://security.microsoft.com/incidents',                                                   hint: 'Active security event management' },
  ],
  'FINRA-MON-2': [
    { label: 'Audit Logs',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',      hint: 'Audit log retention for FINRA regulatory inquiries' },
    { label: 'Compliance Center',   url: 'https://compliance.microsoft.com/auditlogsearch',                                           hint: 'Unified audit log search for FINRA investigations' },
  ],
  'FINRA-MON-3': [
    { label: 'Incidents',           url: 'https://security.microsoft.com/incidents',                                                   hint: 'Incident response management for cybersecurity events' },
    { label: 'Risky Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers', hint: 'Contain compromised accounts during incidents' },
  ],
  'FINRA-MON-4': [
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'MFA adoption as security awareness indicator' },
  ],

  // ─── FINRA Cybersecurity — Business Continuity & Recovery ───────────────
  'FINRA-BCR-1': [
    { label: 'Backup Center',       url: 'https://portal.azure.com/#view/Microsoft_RecoveryServices/BackupCenterBlade',               hint: 'Business continuity and data recovery for broker-dealer' },
  ],
  'FINRA-BCR-2': [
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Patch management and endpoint security for FINRA' },
    { label: 'Defender XDR',        url: 'https://security.microsoft.com/homepage',                                                   hint: 'Endpoint detection and antivirus monitoring' },
  ],

  // ─── FERPA — Identity & Access Management ───────────────────────────────
  'FERPA-IAM-1': [
    { label: 'Roles & Admins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles',             hint: 'Control staff access to student education records' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'CA policies for FERPA-authorized access' },
  ],
  'FERPA-IAM-2': [
    { label: 'Auth Methods',        url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/AuthenticationMethodsMenuBlade/~/AdminAuthMethods', hint: 'MFA for staff accessing student records' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Enforce MFA for student system access' },
  ],
  'FERPA-IAM-3': [
    { label: 'PIM',                 url: 'https://entra.microsoft.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade',           hint: 'Least privilege admin access to student record systems' },
    { label: 'Roles & Admins',      url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesMenuBlade/~/AllRoles' },
  ],
  'FERPA-IAM-4': [
    { label: 'All Users',           url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/AllUsers', hint: 'Remove departed staff access to student systems' },
    { label: 'Audit Logs',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',      hint: 'Verify account termination audit trail' },
  ],

  // ─── FERPA — Data Protection & Privacy ──────────────────────────────────
  'FERPA-DAT-1': [
    { label: 'Info Protection',     url: 'https://compliance.microsoft.com/informationprotection',                                    hint: 'Sensitivity labels for student education records' },
  ],
  'FERPA-DAT-2': [
    { label: 'DLP Policies',        url: 'https://compliance.microsoft.com/datalossprevention',                                       hint: 'DLP to prevent unauthorized student PII disclosure' },
  ],
  'FERPA-DAT-3': [
    { label: 'Intune Compliance',   url: 'https://intune.microsoft.com/#view/Microsoft_Intune_DeviceSettings/DevicesCompliancePoliciesMenu', hint: 'Require encryption on devices with student data' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies',     hint: 'Block unencrypted devices from student record access' },
  ],

  // ─── FERPA — Audit & Accountability ─────────────────────────────────────
  'FERPA-AUD-1': [
    { label: 'Audit Logs',          url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Audit',      hint: 'Log access to student education record systems' },
    { label: 'Compliance Center',   url: 'https://compliance.microsoft.com/auditlogsearch',                                           hint: 'Unified audit log for FERPA disclosure tracking' },
  ],
  'FERPA-AUD-2': [
    { label: 'Alerts',              url: 'https://security.microsoft.com/alerts',                                                      hint: 'Alerts for unauthorized student system access' },
    { label: 'Identity Protection', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/Overview', hint: 'Anomalous access detection for student records' },
  ],

  // ─── FERPA — Third-Party & Directory Controls ────────────────────────────
  'FERPA-3P-1': [
    { label: 'Enterprise Apps',     url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AllApps', hint: 'Third-party apps acting as FERPA school officials' },
    { label: 'Guest Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UsersMenuBlade/~/GuestUsers', hint: 'External parties with student system access' },
  ],
  'FERPA-3P-2': [
    { label: 'External Identities', url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ExternalIdentitiesMenuBlade/~/Overview', hint: 'Restrict directory sharing per FERPA directory exception' },
    { label: 'Conditional Access',  url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ConditionalAccessBlade/~/Policies' },
  ],

  // ─── FERPA — Incident Response & Breach Notification ─────────────────────
  'FERPA-IR-1': [
    { label: 'Incidents',           url: 'https://security.microsoft.com/incidents',                                                   hint: 'Incident response for unauthorized student record access' },
    { label: 'Risky Users',         url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/IdentityProtectionMenuBlade/~/RiskyUsers', hint: 'Contain accounts that may have accessed student records' },
  ],
  'FERPA-IR-2': [
    { label: 'Secure Score',        url: 'https://security.microsoft.com/securescore',                                                 hint: 'Periodic security assessment of student record systems' },
    { label: 'Compliance Manager',  url: 'https://compliance.microsoft.com/compliancemanager',                                        hint: 'FERPA compliance assessment tracking' },
  ],
}

/**
 * Returns portal links for a given control ID, or an empty array if none mapped.
 *
 * Supports three ID formats automatically:
 *   1. NIST CSF 2.0:  "GV.RM-01", "PR.AA-01" (direct lookup)
 *   2. NIST 800-171:  "3.1.1", "3.14.6"       (direct lookup)
 *   3. CMMC L2:       "AC.L2-3.1.1"           (extract "3.1.1" then lookup)
 */
export function getPortalLinks(controlId: string): PortalLink[] {
  // 1. Direct lookup (covers NIST CSF and NIST 800-171 IDs)
  if (LINKS[controlId]) return LINKS[controlId]

  // 2. CMMC L2 format: "{DOMAIN}.L2-{NIST_NUMBER}"
  //    Extract the NIST number and try again
  const dashIdx = controlId.indexOf('-')
  if (dashIdx !== -1 && controlId.includes('.L2-')) {
    const nistNum = controlId.slice(dashIdx + 1)          // e.g. "3.1.1"
    if (LINKS[nistNum]) return LINKS[nistNum]
  }

  return []
}
