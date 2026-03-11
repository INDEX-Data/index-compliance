// =============================================================================
// INDEX DSaaS - Microsoft Graph API Client
// =============================================================================

import { GRAPH_API_BASE, GRAPH_API_BETA } from "../constants.js";
import type { GraphClientConfig, GraphApiResponse } from "../types.js";

export class GraphClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: GraphClientConfig;

  constructor(config: GraphClientConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  private async authenticate(): Promise<string> {
    // If we have a valid token, reuse it
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    // Support both client secret and certificate auth
    if (this.config.clientSecret) {
      body.append("client_secret", this.config.clientSecret);
    }
    // Certificate-based auth would use client_assertion here

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Authentication failed (${response.status}): ${error}. ` +
        `Verify TENANT_ID, CLIENT_ID, and CLIENT_SECRET are correct ` +
        `and the app registration has the required Graph API permissions.`
      );
    }

    const tokenData = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000 - 60000); // 1 min buffer

    return this.accessToken;
  }

  // -------------------------------------------------------------------------
  // API Request Methods
  // -------------------------------------------------------------------------

  async query<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: "v1" | "beta";
      select?: string[];
      filter?: string;
      expand?: string[];
      top?: number;
      orderby?: string;
    } = {}
  ): Promise<GraphApiResponse<T>> {
    const token = await this.authenticate();
    const baseUrl = options.apiVersion === "beta" ? GRAPH_API_BETA : GRAPH_API_BASE;

    // Build query parameters
    const params = new URLSearchParams();
    if (options.select?.length) params.append("$select", options.select.join(","));
    if (options.filter) params.append("$filter", options.filter);
    if (options.expand?.length) params.append("$expand", options.expand.join(","));
    if (options.top) params.append("$top", options.top.toString());
    if (options.orderby) params.append("$orderby", options.orderby);

    const queryString = params.toString();
    const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ConsistencyLevel: "eventual", // Required for some advanced queries
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Graph API error (${response.status}) on ${endpoint}: ${errorBody}. ` +
        `Check that the app registration has the required permissions and admin consent has been granted.`
      );
    }

    const data = await response.json() as GraphApiResponse<T>;
    return data;
  }

  async queryAll<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: "v1" | "beta";
      select?: string[];
      filter?: string;
      expand?: string[];
      maxPages?: number;
      top?: number;
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = [];
    let nextLink: string | undefined;
    let pageCount = 0;
    const maxPages = options.maxPages ?? 10;

    // First page
    const firstPage = await this.query<T>(endpoint, { ...options, top: options.top ?? 100 });
    allResults.push(...firstPage.value);
    nextLink = firstPage["@odata.nextLink"];
    pageCount++;

    // Follow pagination
    while (nextLink && pageCount < maxPages) {
      const token = await this.authenticate();
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) break;

      const data = await response.json() as GraphApiResponse<T>;
      allResults.push(...data.value);
      nextLink = data["@odata.nextLink"];
      pageCount++;
    }

    return allResults;
  }

  // -------------------------------------------------------------------------
  // Convenience methods for common compliance queries
  // -------------------------------------------------------------------------

  async getConditionalAccessPolicies(): Promise<unknown[]> {
    return this.queryAll("/identity/conditionalAccess/policies");
  }

  async getSensitivityLabels(): Promise<unknown[]> {
    return this.queryAll("/informationProtection/policy/labels");
  }

  async getDeviceCompliancePolicies(): Promise<unknown[]> {
    return this.queryAll("/deviceManagement/deviceCompliancePolicies");
  }

  async getRoleAssignments(): Promise<unknown[]> {
    return this.queryAll("/roleManagement/directory/roleAssignments");
  }

  async getSecureScores(): Promise<unknown[]> {
    const result = await this.query("/security/secureScores", { top: 1 });
    return result.value;
  }

  async getSecurityAlerts(): Promise<unknown[]> {
    return this.queryAll("/security/alerts_v2", { top: 50 });
  }

  async getAuthMethodRegistration(): Promise<unknown[]> {
    return this.queryAll("/reports/authenticationMethods/userRegistrationDetails");
  }

  async getRiskyUsers(): Promise<unknown[]> {
    return this.queryAll("/identityProtection/riskyUsers");
  }

  async getDirectoryAudits(
    filter?: string
  ): Promise<unknown[]> {
    return this.queryAll("/auditLogs/directoryAudits", { filter });
  }

  // Raw fetch: path may contain embedded OData query params.
  // Used by the connection-test endpoint which builds its own query strings.
  async rawQuery(relativePath: string): Promise<any> {
    const token = await this.authenticate();
    // If the path already starts with http it's a full URL, otherwise prepend base
    const url = relativePath.startsWith("http")
      ? relativePath
      : `${GRAPH_API_BASE}${relativePath}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type":   "application/json",
        ConsistencyLevel: "eventual",
      },
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Graph API error (${response.status}) on ${relativePath}: ${errorBody}. ` +
        `Check that the app registration has the required permissions and admin consent has been granted.`
      );
    }
    return response.json();
  }

  getTenantId(): string {
    return this.config.tenantId;
  }
}

// -------------------------------------------------------------------------
// Factory function
// -------------------------------------------------------------------------

export function createGraphClient(): GraphClient {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Missing required environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET. " +
      "Create an Entra ID app registration with the required Graph API permissions and provide these values."
    );
  }

  return new GraphClient({
    tenantId,
    clientId,
    clientSecret,
    scopes: ["https://graph.microsoft.com/.default"],
  });
}
