# msgraph-compliance-mcp-server

**INDEX DSaaS** -- Microsoft Graph Compliance Assessment via MCP

An MCP server that connects to Microsoft Graph API, pulls live tenant configuration data, cross-references it against compliance framework controls, and generates evidence-backed compliance posture reports.

---

## Architecture

```
Claude / LLM Client
       |
       | MCP Protocol (stdio or HTTP)
       v
+-------------------------------+
|  MCP Server (this project)    |
|                               |
|  Tools:                       |
|  - compliance_list_frameworks |
|  - compliance_list_controls   |
|  - compliance_assess_control  |
|  - compliance_assess_framework|
|  - compliance_query_graph     |
|  - compliance_get_permissions |
+-------------------------------+
       |
       | Microsoft Graph API (OAuth 2.0 client credentials)
       v
+-------------------------------+
|  Microsoft 365 Tenant         |
|  - Entra ID / Conditional Access
|  - Purview / Sensitivity Labels
|  - DLP Policies               |
|  - Intune / Device Compliance |
|  - Audit Logs                 |
|  - Security Alerts / Score    |
+-------------------------------+
       |
       | Evaluated against
       v
+-------------------------------+
|  Compliance Framework         |
|  Control Mappings             |
|  (CMMC L2, NIST 800-171,     |
|   HIPAA, FINRA, FERPA)       |
+-------------------------------+
```

## How It Works

1. **LLM calls a tool** (e.g., `compliance_assess_framework` with `CMMC_L2`)
2. **Server looks up controls** from the framework registry
3. **For each control**, the server executes one or more Graph API queries to collect evidence
4. **Evidence is evaluated** against the control's criteria using specialized evaluator functions
5. **Results are returned** as structured JSON with pass/fail status, findings, and recommendations

---

## Prerequisites

### 1. Entra ID App Registration

Create an app registration in your target tenant:

1. Go to **Entra ID > App registrations > New registration**
2. Name: `INDEX Compliance Assessment` (or your preference)
3. Supported account types: **Single tenant**
4. Add the following **Application permissions** (not Delegated):
   - `AuditLog.Read.All`
   - `DeviceManagementConfiguration.Read.All`
   - `IdentityRiskEvent.Read.All`
   - `IdentityRiskyUser.Read.All`
   - `InformationProtection.Read.All`
   - `Policy.Read.All`
   - `RoleManagement.Read.Directory`
   - `SecurityEvents.Read.All`
   - `UserAuthenticationMethod.Read.All`
5. **Grant admin consent** for all permissions
6. Create a **client secret** under Certificates & secrets

### 2. Environment Variables

```bash
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-app-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
export TENANT_DISPLAY_NAME="Client Org Name"  # optional, for reports
```

---

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Code (stdio)

Add to your Claude Code MCP config (`~/.claude/claude_code_config.json` or project-level):

```json
{
  "mcpServers": {
    "msgraph-compliance": {
      "command": "node",
      "args": ["/path/to/msgraph-compliance-mcp-server/dist/index.js"],
      "env": {
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_CLIENT_ID": "your-app-client-id",
        "AZURE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### As HTTP Server

```bash
TRANSPORT=http PORT=3001 npm start
```

### Available Tools

| Tool | Description |
|------|-------------|
| `compliance_list_frameworks` | List available compliance frameworks and their status |
| `compliance_list_controls` | List all mapped controls for a framework |
| `compliance_assess_control` | Assess a single control with live Graph evidence |
| `compliance_assess_framework` | Run full framework assessment (the "prove it" tool) |
| `compliance_query_graph` | Direct Graph API query for ad-hoc evidence |
| `compliance_get_permissions` | List required Graph permissions for a framework |

---

## Adding a New Framework

1. Create a new file in `src/data/` (e.g., `hipaa-controls.ts`)
2. Define controls following the `ComplianceControl` interface
3. Map each control to Graph API evidence queries
4. Register the framework in `src/data/framework-registry.ts`
5. Add custom evaluators in `src/services/compliance-engine.ts` if needed

### Control Mapping Template

```typescript
{
  controlId: "HIPAA-164.312(a)(1)",
  title: "Access Control",
  description: "Implement technical policies for systems maintaining ePHI",
  frameworkId: "HIPAA",
  family: "Technical Safeguards",
  evidenceQueries: [
    {
      id: "hipaa-access-ca",
      description: "Conditional Access policies for ePHI systems",
      endpoint: "/identity/conditionalAccess/policies",
      method: "GET",
      category: "conditionalAccess",
      requiredPermissions: ["Policy.Read.All"],
    },
  ],
  evaluationCriteria: {
    type: "custom",
    passingCondition: "CA policies restrict access to ePHI systems",
    customEvaluator: "evaluate_mfa_enforcement",
  },
}
```

---

## Implemented Frameworks

| Framework | Controls Mapped | Status |
|-----------|----------------|--------|
| CMMC Level 2 | 12 | Active |
| NIST 800-171 | -- | Stub |
| HIPAA | -- | Stub |
| FINRA | -- | Stub |
| FERPA | -- | Stub |

---

## Roadmap

- [ ] Complete NIST 800-171 control mappings (significant overlap with CMMC L2)
- [ ] HIPAA Security Rule mappings for healthcare clients
- [ ] FINRA cybersecurity mappings for financial advisor offices
- [ ] FERPA mappings for higher education (Santa Fe College, Penn State use cases)
- [ ] HTML/PDF report generation from assessment results
- [ ] Historical trend tracking (store assessment results, show drift)
- [ ] Automated remediation suggestions with Graph write operations
- [ ] Integration with INDEX Operate tier for continuous monitoring

---

## License

Proprietary -- INDEX Data Security as a Service
