import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { resolveGraphClient } from '@/lib/atlas-client'
import { decryptIfNeeded } from '@/lib/crypto'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const frameworkId = body.frameworkId
    const clientId = body.clientId

    if (!frameworkId) {
      return NextResponse.json({ error: 'frameworkId is required' }, { status: 400 })
    }

    // Resolve client row (needed for job creation before the after() block)
    const admin = getAdminClient()
    let clientRow: any
    if (clientId) {
      const { data, error } = await admin
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .single()
      if (error || !data) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
      clientRow = data
    } else {
      const { data, error } = await admin
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (error || !data) {
        return NextResponse.json(
          { error: 'No M365 tenant connected. Please add a client first.' },
          { status: 400 }
        )
      }
      clientRow = data
    }

    // Validate framework exists before creating a job
    const { getFramework } = await import('@src/data/framework-registry.js')
    const normalizedId = frameworkId.toUpperCase().replace(/-/g, '_')
    const fw = getFramework(normalizedId as any)
    if (!fw || fw.controls.length === 0) {
      return NextResponse.json(
        { error: `Framework "${frameworkId}" not found or not yet implemented` },
        { status: 400 }
      )
    }

    // Preflight: confirm the M365 connection works BEFORE creating a job and
    // sending the user to the running screen. A dead/expired client secret would
    // otherwise produce a "complete" report full of not_assessed verdicts. Fail
    // fast with one actionable message instead.
    try {
      const { GraphAuthError } = await import('@src/services/graph-client.js')
      const { graphClient } = await resolveGraphClient(user.id, clientRow.id)
      try {
        await graphClient.verifyConnection()
      } catch (preflightErr) {
        if (preflightErr instanceof GraphAuthError) {
          return NextResponse.json({ error: preflightErr.userMessage }, { status: 400 })
        }
        // Non-auth failure (e.g. missing Organization.Read.All) — allow the run
        // to proceed; per-control evaluators will report their own permission gaps.
      }
    } catch {
      // resolveGraphClient/import failure is non-fatal here; the background run
      // surfaces its own error via the job's error_message.
    }

    // Create assessment job row
    const { data: job, error: jobErr } = await admin
      .from('assessment_jobs')
      .insert({
        user_id: user.id,
        client_id: clientRow.id,
        framework_id: frameworkId,
        status: 'running',
        total_controls: fw.controls.length,
        current_index: 0,
        progress: [],
      })
      .select()
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Failed to create assessment job' }, { status: 500 })
    }

    const jobId = job.id

    // Run assessment after response is sent so client can subscribe to Realtime
    after(async () => {
      const bg = getAdminClient()
      const progress: any[] = []

      try {
        const { runAssessment } = await import('@src/operations/index.js')
        const { graphClient } = await resolveGraphClient(user.id, clientRow.id)

        await runAssessment(
          {
            frameworkId,
            graphClient,
            clientId: clientRow.id,
            clientName: clientRow.name,
            tenantId: decryptIfNeeded(clientRow.tenant_id),
          },
          {
            onProgress: async (i, _total, title, status) => {
              progress.push({ controlId: title, title, status, done: true })
              await bg
                .from('assessment_jobs')
                .update({
                  current_index: i + 1,
                  current_title: title,
                  progress: [...progress],
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobId)
            },
            onComplete: async (report) => {
              // Save report
              await bg.from('reports').insert({
                id: report.reportId,
                user_id: user.id,
                client_id: clientRow.id,
                framework_id: frameworkId,
                data: report,
                generated_at: report.generatedAt,
              })

              // Save objective statuses (table may not exist in all envs)
              try {
                const objectiveRows = report.objectiveStatuses.map((os) => ({
                  report_id: report.reportId,
                  objective_id: os.objectiveId,
                  status: os.status,
                  evidence_source: os.evidenceSource,
                  attestation_text: os.attestationText ?? null,
                  document_ref: os.documentRef ?? null,
                  assessed_at: os.assessedAt,
                  assessed_by: os.assessedBy ?? 'automated',
                }))
                await bg.from('objective_statuses').insert(objectiveRows)
              } catch {
                // Table may not exist yet — non-fatal
              }

              // Mark job complete
              await bg
                .from('assessment_jobs')
                .update({
                  status: 'complete',
                  report_id: report.reportId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobId)
            },
            onError: async (err) => {
              await bg
                .from('assessment_jobs')
                .update({
                  status: 'error',
                  error_message: err.message,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobId)
            },
          }
        )
      } catch {
        // onError already handled DB update; this catch prevents unhandled rejection
      }
    })

    return NextResponse.json({ ok: true, jobId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assessment failed' },
      { status: 500 }
    )
  }
}
