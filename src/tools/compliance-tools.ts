// =============================================================================
// INDEX DSaaS - Compliance MCP Tools
// Registers all compliance-related tools with the MCP server
// =============================================================================

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GraphClient } from "../services/graph-client.js";
import { assessControl } from "../services/compliance-engine.js";
import {
  listFrameworks,
  getFramework,
  getFrameworkControls,
  getImplementedFrameworks,
} from "../data/framework-registry.js";
import { runAssessment } from "../operations/index.js";
import type { FrameworkId, ControlAssessment } from "../types.js";

// -------------------------------------------------------------------------
// Tool Registration
// -------------------------------------------------------------------------

export function registerComplianceTools(server: McpServer, graphClient: GraphClient): void {

  // -----------------------------------------------------------------------
  // 1. List available compliance frameworks
  // -----------------------------------------------------------------------
  server.registerTool(
    "compliance_list_frameworks",
    {
      title: "List Compliance Frameworks",
      description: `List all available compliance frameworks and their implementation status.

Returns framework IDs, names, versions, and control counts.
Use this to discover which frameworks are available for assessment.

Returns:
  Array of frameworks with: id, name, version, description, controlCount, implemented (boolean)

Examples:
  - "What compliance frameworks can you assess?" -> call with no params
  - "Is CMMC available?" -> call and filter results`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const frameworks = listFrameworks();
      const output = frameworks.map((f) => ({
        id: f.id,
        name: f.name,
        version: f.version,
        description: f.description,
        controlCount: f.controls.length,
        implemented: f.controls.length > 0,
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // -----------------------------------------------------------------------
  // 2. List controls for a framework
  // -----------------------------------------------------------------------
  // @ts-ignore TS2589: MCP SDK Zod schema deep type inference issue
  server.registerTool(
    "compliance_list_controls",
    {
      title: "List Framework Controls",
      description: `List all mapped controls for a specific compliance framework.

Shows control IDs, titles, families, and the Graph API endpoints used for evidence collection.

Args:
  - framework_id: The framework identifier (e.g., "CMMC_L2", "NIST_800_171")

Returns:
  Array of controls with: controlId, title, family, evidenceQueryCount, endpoints[]

Examples:
  - "Show me the CMMC controls" -> framework_id="CMMC_L2"
  - "What does the audit section look like?" -> framework_id="CMMC_L2", then filter by family`,
      inputSchema: {
        framework_id: z.string().describe("Framework identifier (e.g., CMMC_L2, HIPAA, FINRA)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ framework_id }) => {
      const controls = getFrameworkControls((framework_id as string) as FrameworkId);

      if (controls.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No controls mapped for framework "${framework_id}". Use compliance_list_frameworks to see available options.`,
          }],
        };
      }

      const output = controls.map((c) => ({
        controlId: c.controlId,
        title: c.title,
        family: c.family,
        evidenceQueryCount: c.evidenceQueries.length,
        endpoints: c.evidenceQueries.map((q) => q.endpoint),
        requiredPermissions: [...new Set(c.evidenceQueries.flatMap((q) => q.requiredPermissions))],
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // -----------------------------------------------------------------------
  // 3. Assess a single control
  // -----------------------------------------------------------------------
  server.registerTool(
    "compliance_assess_control",
    {
      title: "Assess Single Control",
      description: `Run a compliance assessment against a single control.

Queries Microsoft Graph for evidence, evaluates it against the control requirements,
and returns pass/fail status with findings and recommendations.

Args:
  - framework_id: The framework identifier
  - control_id: The specific control ID (e.g., "AC.L2-3.1.1")

Returns:
  ControlAssessment with: status (pass|fail|partial|not_assessed), findings[], recommendations[], evidence[]

Examples:
  - "Check if MFA is enforced" -> framework_id="CMMC_L2", control_id="IA.L2-3.5.3"
  - "Are we logging audit events?" -> framework_id="CMMC_L2", control_id="AU.L2-3.3.1"`,
      inputSchema: {
        framework_id: z.string().describe("Framework identifier"),
        control_id: z.string().describe("Control identifier within the framework"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ framework_id, control_id }) => {
      const controls = getFrameworkControls((framework_id as string) as FrameworkId);
      const control = controls.find((c) => c.controlId === control_id);

      if (!control) {
        return {
          content: [{
            type: "text",
            text: `Control "${control_id}" not found in framework "${framework_id}". Use compliance_list_controls to see available controls.`,
          }],
        };
      }

      const startTime = Date.now();
      const assessment = await assessControl(control, graphClient);
      const executionTime = Date.now() - startTime;

      const output = {
        ...assessment,
        metadata: {
          executionTimeMs: executionTime,
          queriesExecuted: control.evidenceQueries.length,
          tenant: graphClient.getTenantId(),
        },
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // -----------------------------------------------------------------------
  // 4. Run full framework assessment
  // -----------------------------------------------------------------------
  server.registerTool(
    "compliance_assess_framework",
    {
      title: "Run Full Framework Assessment",
      description: `Run a complete compliance assessment against all mapped controls in a framework.

Queries Microsoft Graph for evidence across all controls, evaluates each one,
and generates a full compliance posture report with summary statistics.

This is the primary "prove it" tool -- it produces an auditor-ready report.

Args:
  - framework_id: The framework to assess (e.g., "CMMC_L2")

Returns:
  ComplianceReport with: summary (pass/fail counts, compliance %, risk score),
  controlAssessments[] (per-control results with evidence)

Examples:
  - "Run a CMMC assessment" -> framework_id="CMMC_L2"
  - "Generate a compliance report" -> framework_id="CMMC_L2"`,
      inputSchema: {
        framework_id: z.string().describe("Framework identifier to assess"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ framework_id }) => {
      const framework = getFramework((framework_id as string) as FrameworkId);

      if (!framework) {
        return {
          content: [{
            type: "text",
            text: `Framework "${framework_id}" not found. Use compliance_list_frameworks to see options.`,
          }],
        };
      }

      if (framework.controls.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Framework "${framework_id}" has no controls mapped yet. Available frameworks with controls: ${getImplementedFrameworks().map((f) => f.id).join(", ")}`,
          }],
        };
      }

      const startTime = Date.now();
      const report = await runAssessment({
        frameworkId: framework.id,
        graphClient,
      });
      const executionTime = Date.now() - startTime;

      const output = {
        ...report,
        metadata: {
          executionTimeMs: executionTime,
          totalQueriesExecuted: framework.controls.reduce(
            (sum, c) => sum + c.evidenceQueries.length, 0
          ),
        },
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );

  // -----------------------------------------------------------------------
  // 5. Query Graph API directly (escape hatch for ad-hoc evidence)
  // -----------------------------------------------------------------------
  // @ts-ignore TS2589: MCP SDK Zod schema deep type inference issue
  server.registerTool(
    "compliance_query_graph",
    {
      title: "Query Microsoft Graph API",
      description: `Execute a direct Microsoft Graph API query for ad-hoc compliance evidence collection.

Use this for exploratory queries or when you need evidence not covered by mapped controls.

Args:
  - endpoint: Graph API endpoint path (e.g., "/identity/conditionalAccess/policies")
  - api_version: "v1" (default) or "beta"
  - select: Optional comma-separated field list
  - filter: Optional OData filter expression
  - top: Optional max results (default 100)

Returns:
  Raw Graph API response data

Examples:
  - "Show me Conditional Access policies" -> endpoint="/identity/conditionalAccess/policies"
  - "List risky users" -> endpoint="/identityProtection/riskyUsers"
  - "Get the Secure Score" -> endpoint="/security/secureScores", top=1`,
      inputSchema: {
        endpoint: z.string().describe("Graph API endpoint path (e.g., /identity/conditionalAccess/policies)"),
        api_version: z.enum(["v1", "beta"]).default("v1").describe("API version"),
        select: z.string().optional().describe("Comma-separated fields to select"),
        filter: z.string().optional().describe("OData filter expression"),
        top: z.number().int().min(1).max(999).default(100).describe("Max results"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await graphClient.query(params.endpoint, {
          apiVersion: params.api_version,
          select: params.select?.split(",").map((s) => s.trim()),
          filter: params.filter,
          top: params.top,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2).slice(0, 50000),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Graph API query failed: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // 6. Get required permissions for a framework
  // -----------------------------------------------------------------------
  server.registerTool(
    "compliance_get_permissions",
    {
      title: "Get Required Graph Permissions",
      description: `List all Microsoft Graph API permissions required to assess a given framework.

Use this to verify your Entra ID app registration has the necessary permissions
before running an assessment.

Args:
  - framework_id: The framework to check permissions for

Returns:
  Deduplicated list of required Graph API permissions

Examples:
  - "What permissions do I need for CMMC?" -> framework_id="CMMC_L2"`,
      inputSchema: {
        framework_id: z.string().describe("Framework identifier"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ framework_id }) => {
      const controls = getFrameworkControls((framework_id as string) as FrameworkId);

      if (controls.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No controls mapped for "${framework_id}".`,
          }],
        };
      }

      const allPermissions = new Set<string>();
      for (const control of controls) {
        for (const query of control.evidenceQueries) {
          for (const perm of query.requiredPermissions) {
            allPermissions.add(perm);
          }
        }
      }

      const output = {
        framework: framework_id,
        requiredPermissions: Array.from(allPermissions).sort(),
        permissionCount: allPermissions.size,
        grantType: "Application (client credentials)",
        note: "All permissions require admin consent in the Entra ID portal",
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2),
        }],
      };
    }
  );
}
