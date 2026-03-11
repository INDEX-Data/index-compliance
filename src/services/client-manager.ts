// =============================================================================
// INDEX DSaaS — Multi-Tenant Client Manager
// Manages per-client Azure credentials for MSP mode.
// Stores clients in web/.config/clients.json
// Auto-migrates legacy credentials.json on first access.
// =============================================================================

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import type { Client } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// dist/services/  →  ../../web/
const WEB_DIR     = join(__dirname, "..", "..", "web");
const CONFIG_DIR  = join(WEB_DIR, ".config");
const CLIENTS_FILE  = join(CONFIG_DIR, "clients.json");
const LEGACY_FILE   = join(CONFIG_DIR, "credentials.json");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Legacy migration ─────────────────────────────────────────────────────

function migrateFromLegacy(): void {
  if (!existsSync(LEGACY_FILE)) return;
  try {
    const legacy = JSON.parse(readFileSync(LEGACY_FILE, "utf8")) as {
      tenantId: string;
      clientId: string;
      clientSecret: string;
      tenantName?: string;
    };
    if (!legacy.tenantId || !legacy.clientId || !legacy.clientSecret) return;

    const client: Client = {
      id:           randomUUID(),
      name:         legacy.tenantName ?? `Tenant ${legacy.tenantId.slice(0, 8)}`,
      tenantId:     legacy.tenantId,
      clientId:     legacy.clientId,
      clientSecret: legacy.clientSecret,
      addedAt:      new Date().toISOString(),
    };
    ensureDir(CONFIG_DIR);
    writeFileSync(CLIENTS_FILE, JSON.stringify([client], null, 2), "utf8");
    console.log(`[Clients] Migrated legacy credentials → "${client.name}" (${client.id})`);
  } catch (err) {
    console.warn("[Clients] Legacy migration failed:", err);
  }
}

// ─── Core I/O ──────────────────────────────────────────────────────────────

function readAll(): Client[] {
  // Auto-migrate on first access when clients.json doesn't exist yet
  if (!existsSync(CLIENTS_FILE) && existsSync(LEGACY_FILE)) {
    migrateFromLegacy();
  }
  try {
    if (!existsSync(CLIENTS_FILE)) return [];
    return JSON.parse(readFileSync(CLIENTS_FILE, "utf8")) as Client[];
  } catch { return []; }
}

function writeAll(clients: Client[]): void {
  ensureDir(CONFIG_DIR);
  writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), "utf8");
}

// ─── Public API ────────────────────────────────────────────────────────────

export function listClients(): Client[] {
  return readAll();
}

export function getClient(id: string): Client | null {
  return readAll().find(c => c.id === id) ?? null;
}

/** Returns the first client (used as default in single-tenant setups). */
export function getDefaultClient(): Client | null {
  const all = readAll();
  return all.length > 0 ? all[0] : null;
}

export function addClient(data: Omit<Client, "id" | "addedAt">): Client {
  const clients = readAll();
  const client: Client = {
    ...data,
    id:      randomUUID(),
    addedAt: new Date().toISOString(),
  };
  clients.push(client);
  writeAll(clients);
  return client;
}

export function upsertByTenantId(data: Omit<Client, "id" | "addedAt"> & { name: string }): Client {
  const clients = readAll();
  const existing = clients.find(c => c.tenantId === data.tenantId);
  if (existing) {
    // Update in-place
    Object.assign(existing, { ...data });
    writeAll(clients);
    return existing;
  }
  return addClient(data);
}

export function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "addedAt">>
): Client | null {
  const clients = readAll();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return null;
  clients[idx] = { ...clients[idx], ...data };
  writeAll(clients);
  return clients[idx];
}

export function deleteClient(id: string): boolean {
  const clients = readAll();
  const filtered = clients.filter(c => c.id !== id);
  if (filtered.length === clients.length) return false;
  writeAll(filtered);
  return true;
}

/** Returns a client with its secret masked for safe API responses. */
export function maskSecret(client: Client): Omit<Client, "clientSecret"> & { clientSecret: string } {
  const { clientSecret, ...rest } = client;
  const masked = clientSecret.length > 4
    ? clientSecret.slice(0, 4) + "••••••••"
    : "••••••••";
  return { ...rest, clientSecret: masked };
}
