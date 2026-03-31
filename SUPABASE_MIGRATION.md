# INDEX — Supabase Migration Guide

## Why This Migration

The current architecture (Vercel + Railway + Clerk + Neon) has 4 independent services that must coordinate auth tokens, CORS headers, and environment variables perfectly. Any mismatch = broken assessments. Supabase consolidates everything into one platform.

**Before (4 services):**
```
Browser → Vercel (frontend)
       → Railway (API + SSE) ← CORS + auth token issues
       → Clerk (auth)
       → Neon (database)
```

**After (1 service):**
```
Browser → Supabase (auth + database + edge functions + realtime)
       → Lovable/Vercel/Netlify (frontend — static, no server logic)
```

No CORS. No token passing between servers. No SSE. Everything goes through the Supabase JS client.

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com → Sign up / Sign in
2. Click "New Project"
3. Name: `index-compliance`
4. Database password: save this somewhere safe
5. Region: pick closest to your users (e.g., East US)
6. Click "Create new project" — wait ~2 minutes

**Save these values (Settings → API):**
- `SUPABASE_URL` — e.g., `https://xxxx.supabase.co`
- `SUPABASE_ANON_KEY` — public, used in frontend
- `SUPABASE_SERVICE_ROLE_KEY` — private, used in Edge Functions only

---

## Step 2: Run the Database Migration

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**

This creates all 13 tables with Row Level Security (RLS) policies and enables Realtime on `assessment_jobs`.

---

## Step 3: Enable Realtime

1. Go to **Database → Replication**
2. Confirm `assessment_jobs` is listed under "supabase_realtime" publication
3. This was done by the migration SQL, but verify it shows up

---

## Step 4: Configure Auth

1. Go to **Authentication → Providers**
2. Email provider should be enabled by default
3. Optional: enable Google, Microsoft, or GitHub OAuth
4. Go to **Authentication → URL Configuration**
5. Set Site URL to your frontend URL (e.g., `https://your-app.lovable.app`)
6. Add redirect URLs for localhost during development

---

## Step 5: Set Edge Function Secrets

1. Go to **Settings → Edge Functions**
2. Add these secrets (or use `supabase secrets set` CLI):

```
ANTHROPIC_API_KEY=sk-ant-...     (for Word report generation)
```

Note: Azure credentials (tenant_id, client_id, client_secret) are stored per-client in the `clients` table — NOT as env vars. The Edge Function reads them from the DB.

---

## Step 6: Deploy Edge Functions

Edge Functions replace the Railway Express server. Deploy using the Supabase CLI:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy edge functions
supabase functions deploy assess
supabase functions deploy test-connection
supabase functions deploy generate-report
```

See `supabase/functions/` for the Edge Function code.

---

## Step 7: Frontend Integration

Whether you use Lovable or your existing Next.js app, the frontend connects to Supabase with:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxxx.supabase.co',    // SUPABASE_URL
  'eyJhbGciOiJI...'              // SUPABASE_ANON_KEY
)
```

### Auth (replaces Clerk)
```typescript
// Sign up
await supabase.auth.signUp({ email, password })

// Sign in
await supabase.auth.signInWithPassword({ email, password })

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Sign out
await supabase.auth.signOut()
```

### Database queries (replaces API calls)
```typescript
// List clients (RLS auto-filters to current user)
const { data: clients } = await supabase.from('clients').select('*')

// List reports
const { data: reports } = await supabase
  .from('reports')
  .select('*')
  .order('generated_at', { ascending: false })

// Get single report
const { data: report } = await supabase
  .from('reports')
  .select('*')
  .eq('id', reportId)
  .single()
```

### Run assessment (replaces SSE stream)
```typescript
// 1. Call the Edge Function to start assessment
const { data: job } = await supabase.functions.invoke('assess', {
  body: { frameworkId: 'CMMC_L2', clientId: 'xxx' }
})

// 2. Subscribe to Realtime updates on the job row
const channel = supabase
  .channel('assessment-progress')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'assessment_jobs',
    filter: `id=eq.${job.jobId}`,
  }, (payload) => {
    const job = payload.new
    // Update progress bar: job.current_index / job.total_controls
    // Update current control: job.current_title
    // Update control list: job.progress (JSON array)
    // Check completion: job.status === 'complete'
    // Get report: job.report_id
  })
  .subscribe()

// 3. Cleanup when done
channel.unsubscribe()
```

---

## Architecture Comparison

| Concern | Before | After |
|---------|--------|-------|
| Auth | Clerk (JWT tokens, CORS headers) | Supabase Auth (built-in, no CORS) |
| Database | Neon PostgreSQL (separate service) | Supabase PostgreSQL (same project) |
| API Server | Railway Express (40+ endpoints) | Supabase RLS + 3 Edge Functions |
| SSE Streaming | fetch() + ReadableStream + CORS | Supabase Realtime (WebSocket, no CORS) |
| File Storage | Base64 in DB | Supabase Storage (or keep in DB) |
| CORS | Complex multi-origin setup | None needed |
| Deployment | Vercel + Railway (2 deploys) | Lovable/Vercel (1 deploy, static) |
| Cost | Vercel Hobby + Railway Hobby + Neon | Supabase Free tier covers all |

---

## What the Edge Functions Do

### `assess` — Run compliance assessment
- Reads client credentials from `clients` table
- Creates a job row in `assessment_jobs`
- Loops through framework controls
- For each control: queries Microsoft Graph API → evaluates → updates job row
- Supabase Realtime pushes updates to frontend automatically
- On completion: saves report to `reports` table

### `test-connection` — Test Azure credentials
- Takes tenantId, clientId, clientSecret
- Gets OAuth token from Microsoft
- Calls /organization endpoint
- Returns success/failure

### `generate-report` — Generate Word document
- Reads report from DB
- Calls Anthropic API for narrative generation
- Builds .docx using docx library
- Returns file as download

---

## Migration Checklist

- [ ] Create Supabase project
- [ ] Run SQL migration (001_initial_schema.sql)
- [ ] Verify Realtime enabled on assessment_jobs
- [ ] Configure auth providers
- [ ] Set Edge Function secrets (ANTHROPIC_API_KEY)
- [ ] Deploy Edge Functions (assess, test-connection, generate-report)
- [ ] Build frontend in Lovable (use the prompt from this repo)
- [ ] Test: sign up → onboard → add client → run assessment → view report
- [ ] Decommission Railway, Clerk, and Neon accounts
