// Microsoft Graph API Client — Deno-compatible port of src/services/graph-client.ts

import type { GraphClientConfig, GraphApiResponse } from './types.ts'

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
const GRAPH_API_BETA = 'https://graph.microsoft.com/beta'

export class GraphClient {
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null
  private config: GraphClientConfig

  constructor(config: GraphClientConfig) {
    this.config = config
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
      client_secret: this.config.clientSecret,
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `Authentication failed (${response.status}): ${error}. ` +
        `Verify TENANT_ID, CLIENT_ID, and CLIENT_SECRET are correct ` +
        `and the app registration has the required Graph API permissions.`
      )
    }

    const tokenData = await response.json() as { access_token: string; expires_in: number }
    this.accessToken = tokenData.access_token
    this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000 - 60000)

    return this.accessToken
  }

  async query<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: 'v1' | 'beta'
      select?: string[]
      filter?: string
      expand?: string[]
      top?: number
      orderby?: string
    } = {}
  ): Promise<GraphApiResponse<T>> {
    const token = await this.authenticate()
    const baseUrl = options.apiVersion === 'beta' ? GRAPH_API_BETA : GRAPH_API_BASE

    const params = new URLSearchParams()
    if (options.select?.length) params.append('$select', options.select.join(','))
    if (options.filter) params.append('$filter', options.filter)
    if (options.expand?.length) params.append('$expand', options.expand.join(','))
    if (options.top) params.append('$top', options.top.toString())
    if (options.orderby) params.append('$orderby', options.orderby)

    const queryString = params.toString()
    const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Graph API error (${response.status}) on ${endpoint}: ${errorBody}. ` +
        `Check that the app registration has the required permissions and admin consent has been granted.`
      )
    }

    return await response.json() as GraphApiResponse<T>
  }

  async queryAll<T = unknown>(
    endpoint: string,
    options: {
      apiVersion?: 'v1' | 'beta'
      select?: string[]
      filter?: string
      expand?: string[]
      maxPages?: number
      top?: number
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = []
    let nextLink: string | undefined
    let pageCount = 0
    const maxPages = options.maxPages ?? 10

    const firstPage = await this.query<T>(endpoint, { ...options, top: options.top ?? 100 })
    allResults.push(...firstPage.value)
    nextLink = firstPage['@odata.nextLink']
    pageCount++

    while (nextLink && pageCount < maxPages) {
      const token = await this.authenticate()
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) break

      const data = await response.json() as GraphApiResponse<T>
      allResults.push(...data.value)
      nextLink = data['@odata.nextLink']
      pageCount++
    }

    return allResults
  }

  async rawQuery(relativePath: string): Promise<unknown> {
    const token = await this.authenticate()
    const url = relativePath.startsWith('http')
      ? relativePath
      : `${GRAPH_API_BASE}${relativePath}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      },
    })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Graph API error (${response.status}) on ${relativePath}: ${errorBody}`)
    }
    return response.json()
  }

  getTenantId(): string {
    return this.config.tenantId
  }
}
