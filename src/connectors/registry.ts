// =============================================================================
// INDEX ATLAS — Connector Registry
// Platform → Connector lookup. Registration happens in index.ts so importing
// the registry has no side effects beyond what index pulls in.
// =============================================================================

import type { Connector } from './types.js'

const REGISTRY = new Map<string, Connector>()

export function registerConnector(connector: Connector): void {
  REGISTRY.set(connector.platform, connector)
}

export function getConnector(platform: string): Connector | undefined {
  return REGISTRY.get(platform)
}

export function listConnectors(): Connector[] {
  return [...REGISTRY.values()]
}
