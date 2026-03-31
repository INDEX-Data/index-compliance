// =============================================================================
// Edge Function: assess
// Runs a compliance framework assessment against a client's Azure tenant.
// Updates the assessment_jobs table in real-time so the frontend can subscribe
// via Supabase Realtime — no SSE/CORS needed.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { createAdminClient, getUser } from '../_shared/supabase.ts'
import { GraphClient } from '../_shared/graph-client.ts'
import { assessControl, buildSummary } from '../_shared/compliance-engine.ts'
import type { ControlAssessment, ComplianceReport, ComplianceControl, FrameworkId } from '../_shared/types.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const { user } = await getUser(authHeader)
    const admin = createAdminClient()

    // Parse request
    const url = new URL(req.url)
    const frameworkId = url.searchParams.get('frameworkId') ?? (await req.json().catch(() => ({}))).frameworkId
    const clientId = url.searchParams.get('clientId') ?? (await req.json().catch(() => ({}))).clientId

    if (!frameworkId) {
      return new Response(JSON.stringify({ error: 'frameworkId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up the client's Azure credentials from the clients table
    let clientRow: any
    if (clientId) {
      const { data, error } = await admin
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .single()
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Client not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      clientRow = data
    } else {
      // Use first client
      const { data, error } = await admin
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'No M365 tenant connected. Please add a client first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      clientRow = data
    }

    // Load controls for this framework from the compiled dist
    // Edge Functions can fetch from the dist/data files at deploy time.
    // For now, we dynamically import the framework controls.
    let controls: ComplianceControl[] = []
    let frameworkName = frameworkId

    try {
      // Import the framework registry — controls are bundled with the function
      const registry = await import('../_shared/framework-registry.ts')
      const fw = registry.getFramework(frameworkId)
      if (fw) {
        controls = fw.controls
        frameworkName = fw.name
      }
    } catch {
      return new Response(JSON.stringify({ error: `Framework "${frameworkId}" not found or not yet implemented` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (controls.length === 0) {
      return new Response(JSON.stringify({ error: `No controls defined for framework "${frameworkId}"` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the assessment job row (triggers Realtime subscription on frontend)
    const { data: job, error: jobErr } = await admin
      .from('assessment_jobs')
      .insert({
        user_id: user.id,
        client_id: clientId ?? clientRow.id,
        framework_id: frameworkId,
        status: 'running',
        total_controls: controls.length,
        current_index: 0,
        progress: [],
      })
      .select()
      .single()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Failed to create assessment job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jobId = job.id

    // Create Graph client with the client's Azure credentials
    const graphClient = new GraphClient({
      tenantId: clientRow.tenant_id,
      clientId: clientRow.client_id,
      clientSecret: clientRow.client_secret,
    })

    // Return the job ID immediately — the assessment runs async in the background
    // The frontend subscribes to Realtime updates on this job row.

    // Run assessment in the background (Edge Function stays alive)
    const assessAsync = async () => {
      const assessments: ControlAssessment[] = []
      const progress: any[] = []

      for (let i = 0; i < controls.length; i++) {
        const control = controls[i]

        try {
          const assessment = await assessControl(control, graphClient)
          assessments.push(assessment)
          progress.push({
            controlId: control.controlId,
            title: control.title,
            status: assessment.status,
            done: true,
          })
        } catch (err) {
          // Create an error assessment
          const errorAssessment: ControlAssessment = {
            controlId: control.controlId,
            controlTitle: control.title,
            frameworkId: control.frameworkId,
            family: control.family,
            status: 'not_assessed',
            evidenceCollected: [],
            findings: [`Error: ${err instanceof Error ? err.message : String(err)}`],
            recommendations: [],
            assessedAt: new Date().toISOString(),
          }
          assessments.push(errorAssessment)
          progress.push({
            controlId: control.controlId,
            title: control.title,
            status: 'not_assessed',
            done: true,
          })
        }

        // Update job row with progress (triggers Realtime)
        await admin
          .from('assessment_jobs')
          .update({
            current_index: i + 1,
            current_title: control.title,
            progress,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      }

      // Build the final report
      const summary = buildSummary(assessments)
      const reportId = `RPT-${Date.now()}`
      const report: ComplianceReport = {
        reportId,
        tenantId: clientRow.tenant_id,
        tenantDisplayName: clientRow.name,
        frameworkId: frameworkId as FrameworkId,
        frameworkName,
        generatedAt: new Date().toISOString(),
        generatedBy: 'INDEX Compliance Assessment Engine v1.0',
        summary,
        controlAssessments: assessments,
        clientId: clientRow.id,
        clientName: clientRow.name,
      }

      // Save the report
      await admin
        .from('reports')
        .insert({
          id: reportId,
          user_id: user.id,
          client_id: clientRow.id,
          framework_id: frameworkId,
          data: report,
          generated_at: report.generatedAt,
        })

      // Mark job as complete
      await admin
        .from('assessment_jobs')
        .update({
          status: 'complete',
          report_id: reportId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    // Fire and await — Edge Function stays alive for the full assessment
    // We use waitUntil-style pattern: start the work but return the response
    // immediately so the client knows the job ID.
    // Note: Deno Deploy / Supabase Edge Functions keep the function alive
    // as long as there are pending promises.
    const assessPromise = assessAsync().catch(async (err) => {
      // On error, mark the job as failed
      await admin
        .from('assessment_jobs')
        .update({
          status: 'error',
          error_message: err instanceof Error ? err.message : String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    })

    // For Supabase Edge Functions, we need to await the promise before returning
    // to keep the function alive. Use EdgeRuntime.waitUntil if available,
    // otherwise await directly.
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
      (globalThis as any).EdgeRuntime.waitUntil(assessPromise)
    } else {
      // Fallback: await the assessment (function stays alive until complete)
      await assessPromise
    }

    return new Response(JSON.stringify({
      ok: true,
      jobId,
      message: 'Assessment started. Subscribe to Realtime on assessment_jobs for progress.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal server error',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
