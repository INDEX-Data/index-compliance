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

// Lazy per-field validation via Proxy. Each env var is validated on first
// access, NOT at module load. This prevents the cascade failure where one
// missing var (e.g. CRON_SECRET) crashes every route that imports env —
// the module-load throw produced an HTML 500 page instead of a JSON error.
// Validation errors now surface inside request handlers, where route-level
// try/catch returns a readable JSON message naming the exact variable.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

const validatedCache = new Map<string, unknown>()

const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    // During `next build`, env vars aren't injected — skip validation
    if (isBuildPhase) return process.env[prop]

    if (validatedCache.has(prop)) return validatedCache.get(prop)

    const fieldSchema = (envSchema.shape as Record<string, z.ZodTypeAny>)[prop]
    if (!fieldSchema) return process.env[prop]

    const parsed = fieldSchema.safeParse(process.env[prop])
    if (!parsed.success) {
      throw new Error(
        `Invalid environment variable ${prop}: ${parsed.error.issues[0]?.message ?? 'validation failed'}. ` +
          'Check your deployment environment settings (Vercel → Project → Settings → Environment Variables).'
      )
    }

    validatedCache.set(prop, parsed.data)
    return parsed.data
  },
})

export default env
