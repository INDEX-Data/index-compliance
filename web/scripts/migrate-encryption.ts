// =============================================================================
// One-time migration: encrypt existing plaintext client credentials
// Run from web/: npx tsx scripts/migrate-encryption.ts
// Requires: ENCRYPTION_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const val = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* rely on existing env */ }

const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string')
  }
  return Buffer.from(hex, 'hex')
}

function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  getKey() // validate upfront

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, tenant_id, client_id, client_secret')

  if (error) {
    console.error('Failed to fetch clients:', error.message)
    process.exit(1)
  }

  let migrated = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of clients ?? []) {
    if (isEncrypted(row.client_secret)) {
      skipped++
      console.log(`  SKIP ${row.id} (already encrypted)`)
      continue
    }

    try {
      const { error: updateErr } = await admin
        .from('clients')
        .update({
          tenant_id: encrypt(row.tenant_id),
          client_id: encrypt(row.client_id),
          client_secret: encrypt(row.client_secret),
        })
        .eq('id', row.id)

      if (updateErr) throw new Error(updateErr.message)
      migrated++
      console.log(`  OK   ${row.id} encrypted`)
    } catch (err: any) {
      errors.push(`${row.id}: ${err.message}`)
      console.error(`  ERR  ${row.id}: ${err.message}`)
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors.length}`)
  if (errors.length > 0) {
    console.error('Errors:', errors)
    process.exit(1)
  }
}

main()
