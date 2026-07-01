// =============================================================================
// INDEX ATLAS — Connector Framework public surface
// Importing this module registers all built-in connectors as a side effect.
// =============================================================================

import { registerConnector } from './registry.js'
import { m365Connector } from './m365/connector.js'

registerConnector(m365Connector)

export * from './types.js'
export { getConnector, listConnectors, registerConnector } from './registry.js'
export { m365Connector } from './m365/connector.js'
