import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { DIBCAC_OBJECTIVES } from '@src/data/dibcac-objectives.js'
import type { ObjectiveStatusValue, ObjectiveEvidenceSource } from '@src/types.js'

// ── Enrich stored statuses with full DIBCAC objective definitions ───────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reportId = body.reportId
    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Load stored objective statuses for this report
    const { data: rows } = await admin
      .from('objective_statuses')
      .select('*')
      .eq('report_id', reportId)

    // Build a lookup from objectiveId → stored status
    const statusMap = new Map<string, any>()
    for (const row of rows ?? []) {
      statusMap.set(row.objective_id, row)
    }

    // If no rows in objective_statuses table, try to get from report JSON
    let fromReportJson = false
    if (statusMap.size === 0) {
      const { data: report } = await admin
        .from('reports')
        .select('data')
        .eq('id', reportId)
        .single()

      if (report?.data?.objectiveStatuses) {
        fromReportJson = true
        for (const os of report.data.objectiveStatuses) {
          statusMap.set(os.objectiveId, {
            objective_id: os.objectiveId,
            status: os.status,
            evidence_source: os.evidenceSource,
            attestation_text: os.attestationText,
            document_ref: os.documentRef,
            document_name: os.documentName,
            assessed_at: os.assessedAt,
            assessed_by: os.assessedBy,
          })
        }
      }
    }

    // Enrich each DIBCAC objective with its stored status
    const objectives = DIBCAC_OBJECTIVES.map(def => {
      const stored = statusMap.get(def.objectiveId)
      const status = stored ? {
        objectiveId: def.objectiveId,
        status: (stored.status ?? 'not_assessed') as ObjectiveStatusValue,
        evidenceSource: (stored.evidence_source ?? 'none') as ObjectiveEvidenceSource,
        attestationText: stored.attestation_text ?? undefined,
        documentRef: stored.document_ref ?? undefined,
        documentName: stored.document_name ?? undefined,
        assessedAt: stored.assessed_at ?? undefined,
        assessedBy: stored.assessed_by ?? undefined,
      } : {
        objectiveId: def.objectiveId,
        status: (def.automation === 'physical' ? 'requires_physical'
          : def.automation === 'manual' ? 'requires_manual'
          : 'not_assessed') as ObjectiveStatusValue,
        evidenceSource: 'none' as ObjectiveEvidenceSource,
      }

      return {
        objectiveId: def.objectiveId,
        requirementNumber: def.requirementNumber,
        controlId: def.controlId,
        domain: def.domain,
        domainName: def.domainName,
        text: def.text,
        standard: def.standard,
        automation: def.automation,
        status,
      }
    })

    // Compute summary
    const statuses = objectives.map(o => o.status.status)
    const summary = {
      total: statuses.length,
      met: statuses.filter(s => s === 'met').length,
      partiallyMet: statuses.filter(s => s === 'partially_met').length,
      notMet: statuses.filter(s => s === 'not_met').length,
      requiresManual: statuses.filter(s => s === 'requires_manual').length,
      requiresPhysical: statuses.filter(s => s === 'requires_physical').length,
      notAssessed: statuses.filter(s => s === 'not_assessed').length,
      coveragePercentage: 0,
    }
    const assessable = summary.total - summary.requiresPhysical
    summary.coveragePercentage = assessable > 0
      ? Math.round(((summary.met + summary.partiallyMet * 0.5) / assessable) * 100)
      : 0

    return NextResponse.json({
      reportId,
      summary,
      objectives,
    })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load objectives' },
      { status: 500 }
    )
  }
}
