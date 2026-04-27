/**
 * Environment variable validation using Zod.
 *
 * This file is SERVER-SIDE ONLY — never import it in client components.
 * It validates and exports all env vars at module load time, so a
 * misconfigured deployment fails loudly at startup rather than silently
 * mid-request.
 *
 * Usage:
 *   import env from '@/lib/env'
 *   const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
 */

import { z } from 'zod'

const envSchema = z.object({
  // ── Supabase ──────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL is required')
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // ── Encryption ─────────────────────────────────���──────────────────────────
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (AES-256)'),

  // ── AI (Anthropic) ────────────────────────────────────────���───────────────
  INDEX_ANTHROPIC_KEY: z
    .string()
    .min(1, 'INDEX_ANTHROPIC_KEY is required')
    .startsWith('sk-ant-', 'INDEX_ANTHROPIC_KEY must be a valid Anthropic API key'),

  // ── Scheduled tasks ────────────────────────���──────────────────────────────
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // ── Access control ────────────────────────────────────────────────────────
  /** Restrict sign-up to this email domain. Leave empty to allow any domain. */
  NEXT_PUBLIC_ALLOWED_DOMAIN: z.string().optional(),

  // ── Runtime ───────────────────────────────────────────────────────��───────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

// Validate immediately at module load — throws on misconfiguration
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(
    `\n\n❌ Invalid environment variables:\n${issues}\n\nCheck your .env.local file.\n`
  )
}

const env = parsed.data

export default env
