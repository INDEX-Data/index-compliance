// =============================================================================
// Edge Function: generate-report
// Generates Word/OPA/ZIP export from a saved compliance report.
// Uses Claude API for narrative generation (Word format).
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'
import { createAdminClient, getUser } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const { user } = await getUser(authHeader)
    const admin = createAdminClient()
    const body = await req.json()
    const { reportId, format } = body

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch report data
    const { data: reportRow, error } = await admin
      .from('reports')
      .select('data')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (error || !reportRow) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const report = reportRow.data

    if (format === 'word' || format === 'opa') {
      // Word/OPA generation requires the docx library and Claude API
      // For now, return a JSON summary as a downloadable file
      // Full Word generation will be ported from src/services/report-generator.ts
      const content = JSON.stringify(report, null, 2)
      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${reportId}_${format}.json"`,
        },
      })
    }

    if (format === 'zip') {
      // Evidence ZIP — collect evidence data from report
      const content = JSON.stringify({
        reportId,
        framework: report.frameworkName,
        controls: report.controlAssessments?.map((a: any) => ({
          controlId: a.controlId,
          status: a.status,
          evidence: a.evidenceCollected?.map((e: any) => ({
            query: e.queryDescription,
            endpoint: e.endpoint,
            recordCount: e.recordCount,
            success: e.success,
          })),
        })),
      }, null, 2)

      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="Evidence_${reportId}.json"`,
        },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown format: ${format}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Export failed',
    }), {
      status: err instanceof Error && err.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
