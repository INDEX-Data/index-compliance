#!/usr/bin/env node
// =============================================================================
// INDEX DSaaS - MCP Server Setup Wizard
// Interactive configuration generator for new installs
// =============================================================================

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the actual dist/index.js path (works whether installed globally or locally)
const serverPath = path.resolve(__dirname, "index.js");

// -------------------------------------------------------------------------
// Readline helpers
// -------------------------------------------------------------------------

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string, defaultValue = ""): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);

    // Disable echo for secret input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let input = "";
    const onData = (char: Buffer) => {
      const c = char.toString();
      if (c === "\r" || c === "\n") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (c === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(0);
      } else if (c === "\u007f" || c === "\b") {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (c === "\u0016") {
        // Ctrl+V (Windows paste trigger in raw mode) — silently ignore;
        // the actual pasted characters arrive in subsequent data events
      } else {
        input += c;
        process.stdout.write("*");
      }
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// -------------------------------------------------------------------------
// Config builder
// -------------------------------------------------------------------------

interface McpConfig {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env: Record<string, string>;
  }>;
}

function buildConfig(
  serverName: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
  tenantDisplayName: string
): McpConfig {
  const env: Record<string, string> = {
    AZURE_TENANT_ID: tenantId,
    AZURE_CLIENT_ID: clientId,
    AZURE_CLIENT_SECRET: clientSecret,
  };

  if (tenantDisplayName) {
    env["TENANT_DISPLAY_NAME"] = tenantDisplayName;
  }

  return {
    mcpServers: {
      [serverName]: {
        command: "node",
        args: [serverPath],
        env,
      },
    },
  };
}

function mergeConfig(existing: McpConfig, addition: McpConfig): McpConfig {
  return {
    ...existing,
    mcpServers: {
      ...existing.mcpServers,
      ...addition.mcpServers,
    },
  };
}

// -------------------------------------------------------------------------
// Output helpers
// -------------------------------------------------------------------------

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), ".claude", "claude_code_config.json");

async function writeToClaudeConfig(config: McpConfig): Promise<void> {
  const dir = path.dirname(CLAUDE_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let merged = config;
  if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CLAUDE_CONFIG_PATH, "utf8")) as McpConfig;
      merged = mergeConfig(existing, config);
    } catch {
      // Existing file malformed — overwrite
    }
  }

  fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(merged, null, 2), "utf8");
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   INDEX DSaaS — Microsoft Graph Compliance MCP Setup    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("This wizard will configure the MCP server for Claude Code.\n");
  console.log("You will need:");
  console.log("  • Azure Tenant ID");
  console.log("  • App Registration Client ID");
  console.log("  • App Registration Client Secret (Value, not ID)\n");
  console.log("─".repeat(60) + "\n");

  // Collect credentials
  const tenantId = await ask("Azure Tenant ID");
  if (!tenantId) {
    console.error("\n[ERROR] Tenant ID is required.");
    process.exit(1);
  }

  const clientId = await ask("App Registration Client ID");
  if (!clientId) {
    console.error("\n[ERROR] Client ID is required.");
    process.exit(1);
  }

  const clientSecret = await askSecret("App Registration Client Secret");
  if (!clientSecret) {
    console.error("\n[ERROR] Client Secret is required.");
    process.exit(1);
  }

  const tenantDisplayName = await ask("Tenant display name (optional, e.g. Contoso)", "");
  const serverName = await ask("MCP server name in Claude config", "msgraph-compliance");

  console.log("\n" + "─".repeat(60));

  const config = buildConfig(serverName, tenantId, clientId, clientSecret, tenantDisplayName);

  // Show the generated config
  console.log("\nGenerated claude_code_config.json snippet:\n");
  console.log(JSON.stringify(config, null, 2));
  console.log("\n" + "─".repeat(60));

  // Ask whether to write it
  const write = await ask("\nWrite to ~/.claude/claude_code_config.json? (yes/no)", "yes");

  if (write.toLowerCase().startsWith("y")) {
    try {
      await writeToClaudeConfig(config);
      console.log(`\n[OK] Configuration written to: ${CLAUDE_CONFIG_PATH}`);
    } catch (err) {
      console.error("\n[ERROR] Could not write config file:", err instanceof Error ? err.message : err);
      console.log("\nManually add the snippet above to your Claude Code config file.");
    }
  } else {
    console.log("\nSkipped writing. Manually add the snippet above to your Claude Code config file.");
  }

  console.log("\n✓ Setup complete! Restart Claude Code to load the MCP server.");
  console.log("  Required Graph API permissions for full assessment:");
  console.log("  • AuditLog.Read.All");
  console.log("  • Policy.Read.All");
  console.log("  • UserAuthenticationMethod.Read.All");
  console.log("  • DeviceManagementConfiguration.Read.All");
  console.log("  • RoleManagement.Read.Directory");
  console.log("  • SecurityEvents.Read.All");
  console.log("  • IdentityRiskEvent.Read.All\n");

  rl.close();
}

main().catch((err) => {
  console.error("[ERROR]", err);
  rl.close();
  process.exit(1);
});
