// =============================================================================
// INDEX DSaaS — Multi-Tenant Client Manager (DB-backed)
// Manages per-client Azure credentials for MSP mode.
// Uses Neon PostgreSQL via Drizzle ORM — persists across deployments.
// =============================================================================

import { db } from "../db/client.js";
import { clients as clientsTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Client } from "../types.js";

// ─── Type conversion ───────────────────────────────────────────────────────

type DbRow = typeof clientsTable.$inferSelect;

function toClient(row: DbRow): Client {
  return {
    id:           row.id,
    name:         row.name,
    tenantId:     row.tenantId,
    clientId:     row.clientId,
    clientSecret: row.clientSecret,
    addedAt:      row.addedAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/** List all clients. If userId is provided, filters to that user's clients only. */
export async function listClients(userId?: string): Promise<Client[]> {
  const rows = userId
    ? await db.select().from(clientsTable).where(eq(clientsTable.userId, userId))
    : await db.select().from(clientsTable);
  return rows.map(toClient);
}

/** Get a single client by ID. */
export async function getClient(id: string, userId?: string): Promise<Client | null> {
  const conditions = userId
    ? and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))
    : eq(clientsTable.id, id);
  const rows = await db.select().from(clientsTable).where(conditions).limit(1);
  return rows.length > 0 ? toClient(rows[0]) : null;
}

/** Returns the first client (used as default in single-tenant setups). */
export async function getDefaultClient(userId?: string): Promise<Client | null> {
  const rows = userId
    ? await db.select().from(clientsTable).where(eq(clientsTable.userId, userId)).limit(1)
    : await db.select().from(clientsTable).limit(1);
  return rows.length > 0 ? toClient(rows[0]) : null;
}

/** Add a new client. userId scopes the client to the creating user. */
export async function addClient(
  data: Omit<Client, "id" | "addedAt">,
  userId: string = "default",
): Promise<Client> {
  const id = randomUUID();
  const rows = await db.insert(clientsTable).values({
    id,
    userId,
    externalId: id,
    name:         data.name,
    tenantId:     data.tenantId,
    clientId:     data.clientId,
    clientSecret: data.clientSecret,
  }).returning();
  return toClient(rows[0]);
}

/** Upsert by tenantId — used by the setup wizard. */
export async function upsertByTenantId(
  data: Omit<Client, "id" | "addedAt"> & { name: string },
  userId: string = "default",
): Promise<Client> {
  const existing = await db.select()
    .from(clientsTable)
    .where(and(eq(clientsTable.tenantId, data.tenantId), eq(clientsTable.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    const rows = await db.update(clientsTable)
      .set({
        name:         data.name,
        clientId:     data.clientId,
        clientSecret: data.clientSecret,
      })
      .where(eq(clientsTable.id, existing[0].id))
      .returning();
    return toClient(rows[0]);
  }
  return addClient(data, userId);
}

/** Update an existing client. */
export async function updateClient(
  id: string,
  data: Partial<Omit<Client, "id" | "addedAt">>,
  userId?: string,
): Promise<Client | null> {
  const conditions = userId
    ? and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))
    : eq(clientsTable.id, id);
  const rows = await db.update(clientsTable).set(data).where(conditions).returning();
  return rows.length > 0 ? toClient(rows[0]) : null;
}

/** Delete a client. Returns true if a row was deleted. */
export async function deleteClient(id: string, userId?: string): Promise<boolean> {
  const conditions = userId
    ? and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))
    : eq(clientsTable.id, id);
  const rows = await db.delete(clientsTable).where(conditions).returning();
  return rows.length > 0;
}

/** Returns a client with its secret masked for safe API responses. */
export function maskSecret(client: Client): Omit<Client, "clientSecret"> & { clientSecret: string } {
  const { clientSecret, ...rest } = client;
  const masked = clientSecret.length > 4
    ? clientSecret.slice(0, 4) + "••••••••"
    : "••••••••";
  return { ...rest, clientSecret: masked };
}
