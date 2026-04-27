/**
 * Environment variable validation using Zod.
 *
 * SERVER-SIDE ONLY — never import this in client components.
 *
 * Validates all required env vars at module load time so a misconfigured
 * deployment fails loudly with a clear error rather than silently mid-request.
 *
 * During `next build` (NEXT_PHASE=phase-production-build) validation is skipped
 * because env vars are not injected at build time — only at runtime on the server.
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

  // ── Encryption ────────────────────────────────────────────────────────────
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (AES-256)'),

  // ── AI (Anthropic) ────────────────────────────────────────────────────────
  INDEX_ANTHROPIC_KEY: z
    .string()
    .min(1, 'INDEX_ANTHROPIC_KEY is required')
    .startsWith('sk-ant-', 'INDEX_ANTHROPIC_KEY must be a valid Anthropic API key'),

  // ── Scheduled tasks ───────────────────────────────────────────────────────
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // ── Access control ────────────────────────────────────────────────────────
  /** Restrict sign-up to this email domain. Leave empty to allow any domain. */
  NEXT_PUBLIC_ALLOWED_DOMAIN: z.string().optional(),

  // ── Runtime ───────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

// During `next build`, Next.js collects page data without injecting runtime env vars.
// Skip validation in that phase — it runs fine at server startup when vars are present.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

let env: Env

if (isBuildPhase) {
  // Cast without validation — values won't be used during static analysis
  env = process.env as unknown as Env
} else {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `\n\n❌ Invalid environment variables:\n${issues}\n\nCheck your .env.local file.\n`
    )
  }

  env = parsed.data
}

export default env
