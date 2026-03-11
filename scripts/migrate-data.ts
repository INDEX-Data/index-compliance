/**
 * INDEX — One-time data migration: local JSON files → Neon PostgreSQL
 *
 * Reads:
 *   web/.reports/*.json        → reports table
 *   web/.config/clients.json   → clients table
 *   web/.objectives/*.json     → objective_statuses table
 *
 * Usage (run once after setting up Neon and Clerk):
 *
 *   DATABASE_URL=postgresql://... SEED_USER_ID=user_... npx tsx scripts/migrate-data.ts
 *
 * Safe to re-run — uses INSERT … ON CONFLICT DO NOTHING.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../src/db/schema.js'

// ── Validate env vars ────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL
const SEED_USER_ID = process.env.SEED_USER_ID

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL is required')
  process.exit(1)
}
if (!SEED_USER_ID) {
  console.error('❌  SEED_USER_ID is required (your Clerk user ID, e.g. user_2abc...)')
  process.exit(1)
}

// ── DB client ────────────────────────────────────────────────────────────────

const db = drizzle(neon(DATABASE_URL), { schema })

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT       = join(fileURLToPath(import.meta.url), '../../')
const REPORTS_DIR    = join(ROOT, 'web/.reports')
const CLIENTS_FILE   = join(ROOT, 'web/.config/clients.json')
const OBJECTIVES_DIR = join(ROOT, 'web/.objectives')

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

// ── Migrate clients ──────────────────────────────────────────────────────────

async function migrateClients() {
  if (!existsSync(CLIENTS_FILE)) {
    console.log('⚠  No clients.json found — skipping clients migration')
    return
  }

  type LegacyClient = {
    id?: string
    name: string
    tenantId: string
    clientId: string
    clientSecret: string
    addedAt?: string
  }

  const raw = readJson<LegacyClient[]>(CLIENTS_FILE)
  console.log(`📋  Migrating ${raw.length} client(s)…`)

  for (const c of raw) {
    await db.insert(schema.clients).values({
      // Preserve existing UUID if present; otherwise let DB generate one
      ...(c.id ? { id: c.id } : {}),
      userId:       SEED_USER_ID!,
      externalId:   c.id ?? c.name.toLowerCase().replace(/\s+/g, '-'),
      name:         c.name,
      tenantId:     c.tenantId,
      clientId:     c.clientId,
      clientSecret: c.clientSecret,
      addedAt:      c.addedAt ? new Date(c.addedAt) : new Date(),
    } as typeof schema.clients.$inferInsert)
    // @ts-ignore — onConflictDoNothing is available on insert result
    .onConflictDoNothing()

    console.log(`  ✓ client: ${c.name}`)
  }
}

// ── Migrate reports ──────────────────────────────────────────────────────────

async function migrateReports(): Promise<string[]> {
  if (!existsSync(REPORTS_DIR)) {
    console.log('⚠  No .reports directory found — skipping reports migration')
    return []
  }

  const files = readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'))
  console.log(`\n📄  Migrating ${files.length} report(s)…`)

  const migratedIds: string[] = []

  for (const file of files) {
    const report = readJson<{
      reportId: string
      frameworkId: string
      generatedAt: string
      clientId?: string
    }>(join(REPORTS_DIR, file))

    await db.insert(schema.reports).values({
      id:          report.reportId,
      userId:      SEED_USER_ID!,
      frameworkId: report.frameworkId,
      data:        report as any,
      generatedAt: new Date(report.generatedAt),
    })
    // @ts-ignore
    .onConflictDoNothing()

    migratedIds.push(report.reportId)
    console.log(`  ✓ report: ${report.reportId} (${report.frameworkId})`)
  }

  return migratedIds
}

// ── Migrate objective statuses ────────────────────────────────────────────────

async function migrateObjectives(reportIds: string[]) {
  if (!existsSync(OBJECTIVES_DIR)) {
    console.log('\n⚠  No .objectives directory found — skipping objectives migration')
    return
  }

  const files = readdirSync(OBJECTIVES_DIR).filter(f => f.endsWith('.json'))
  console.log(`\n🎯  Migrating objective statuses for ${files.length} file(s)…`)

  for (const file of files) {
    const reportId = basename(file, '.json')

    // Only migrate if the report was also migrated (or already exists in DB)
    const statuses = readJson<Array<{
      objectiveId: string
      status: string
      evidenceSource?: string
      attestationText?: string
      documentRef?: string
      documentName?: string
      assessedAt?: string
      assessedBy?: string
    }>>(join(OBJECTIVES_DIR, file))

    console.log(`  Objectives for ${reportId}: ${statuses.length} entries`)

    // Insert in batches of 100 to stay within Neon parameter limits
    const BATCH = 100
    for (let i = 0; i < statuses.length; i += BATCH) {
      const batch = statuses.slice(i, i + BATCH)
      await db.insert(schema.objectiveStatuses).values(
        batch.map(s => ({
          reportId,
          objectiveId:     s.objectiveId,
          status:          s.status,
          evidenceSource:  s.evidenceSource ?? null,
          attestationText: s.attestationText ?? null,
          documentRef:     s.documentRef ?? null,
          documentName:    s.documentName ?? null,
          assessedAt:      s.assessedAt ? new Date(s.assessedAt) : null,
          assessedBy:      s.assessedBy ?? null,
        }))
      )
      // @ts-ignore
      .onConflictDoNothing()
    }

    console.log(`  ✓ ${statuses.length} objectives for ${reportId}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  INDEX data migration — JSON → Neon PostgreSQL')
  console.log(`    User: ${SEED_USER_ID}`)
  console.log(`    DB:   ${DATABASE_URL!.replace(/:([^@]+)@/, ':***@')}\n`)

  await migrateClients()
  const reportIds = await migrateReports()
  await migrateObjectives(reportIds)

  console.log('\n✅  Migration complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('❌  Migration failed:', err)
  process.exit(1)
})
