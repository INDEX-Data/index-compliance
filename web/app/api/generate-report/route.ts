import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { generateWordReport } from '@src/services/report-generator.js'
import type { ComplianceReport } from '@src/types.js'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { reportId, format } = body

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    // Use INDEX_ANTHROPIC_KEY to avoid collision with Claude Code's env var
    const anthropicKey = process.env.INDEX_ANTHROPIC_KEY
    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add INDEX_ANTHROPIC_KEY to .env.local' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Load report data
    const { data: row, error: reportErr } = await admin
      .from('reports')
      .select('data')
      .eq('id', reportId)
      .single()

    if (reportErr || !row?.data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const report = row.data as ComplianceReport

    if (format === 'word') {
      // Generate Word doc via Claude AI + docx builder
      const buffer = await generateWordReport(report, anthropicKey)

      return new Response(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${reportId}.docx"`,
        },
      })
    }

    if (format === 'opa') {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Atlas Compliance Platform'
      workbook.created = new Date()

      // ── Sheet 1: Summary ──
      const summary = workbook.addWorksheet('Summary')
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B2A4A' } }
      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
      const titleFont = { bold: true, size: 14, color: { argb: 'FF1B2A4A' } }

      summary.getColumn('A').width = 30
      summary.getColumn('B').width = 50

      summary.getRow(1).height = 30
      const titleCell = summary.getCell('A1')
      titleCell.value = 'Operational Plan of Action (OPA)'
      titleCell.font = titleFont
      summary.mergeCells('A1:B1')

      const failedControls = report.controlAssessments
        .filter(a => a.status === 'fail' || a.status === 'partial')
      const totalControls = report.controlAssessments.length
      const passCount = report.controlAssessments.filter(a => a.status === 'pass').length
      const score = totalControls > 0 ? Math.round((passCount / totalControls) * 100) : 0
      const riskLevel = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : score >= 40 ? 'High' : 'Critical'

      const summaryData = [
        ['Report ID', report.reportId],
        ['Framework', report.frameworkName],
        ['Tenant', report.tenantDisplayName],
        ['Generated At', new Date().toISOString()],
        ['Total Controls Assessed', totalControls],
        ['Passing Controls', passCount],
        ['Failed / Partial Controls', failedControls.length],
        ['Compliance Score', `${score}%`],
        ['Risk Level', riskLevel],
      ]

      summaryData.forEach((pair, i) => {
        const row = summary.getRow(i + 3)
        row.getCell(1).value = pair[0]
        row.getCell(1).font = { bold: true, size: 11 }
        row.getCell(2).value = pair[1]
        row.getCell(2).font = { size: 11 }
        if (i % 2 === 0) {
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }
          row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }
        }
      })

      // ── Sheet 2: Remediation Plan ──
      const plan = workbook.addWorksheet('Remediation Plan')
      const columns = [
        { header: 'Priority', key: 'priority', width: 12 },
        { header: 'Control ID', key: 'controlId', width: 16 },
        { header: 'Control Title', key: 'controlTitle', width: 40 },
        { header: 'Family', key: 'family', width: 22 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Finding', key: 'finding', width: 50 },
        { header: 'Recommendation', key: 'recommendation', width: 50 },
        { header: 'Remediation Owner', key: 'owner', width: 22 },
        { header: 'Target Date', key: 'targetDate', width: 16 },
        { header: 'Notes', key: 'notes', width: 30 },
      ]
      plan.columns = columns

      // Style header row
      const headerRow = plan.getRow(1)
      headerRow.height = 24
      headerRow.eachCell((cell) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
        }
      })

      // Add data rows
      failedControls
        .sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1))
        .forEach((ctrl, i) => {
          const priority = ctrl.status === 'fail' ? 'Critical' : 'High'
          const finding = Array.isArray(ctrl.findings) && ctrl.findings.length > 0
            ? ctrl.findings[0] : ''
          const recommendation = Array.isArray(ctrl.recommendations) && ctrl.recommendations.length > 0
            ? ctrl.recommendations[0] : ''

          const row = plan.addRow({
            priority,
            controlId: ctrl.controlId,
            controlTitle: ctrl.controlTitle,
            family: ctrl.family,
            status: ctrl.status.toUpperCase(),
            finding,
            recommendation,
            owner: '',
            targetDate: '',
            notes: '',
          })

          row.alignment = { vertical: 'top', wrapText: true }

          // Alternating row colors
          if (i % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
            })
          }

          // Color-code priority
          const priorityCell = row.getCell(1)
          priorityCell.font = {
            bold: true,
            color: { argb: priority === 'Critical' ? 'FFDC2626' : 'FFEA580C' },
          }

          // Color-code status
          const statusCell = row.getCell(5)
          statusCell.font = {
            bold: true,
            color: { argb: ctrl.status === 'fail' ? 'FFDC2626' : 'FFF59E0B' },
          }
        })

      // Auto-filter on header row
      plan.autoFilter = { from: 'A1', to: 'J1' }

      // Freeze top row
      plan.views = [{ state: 'frozen', ySplit: 1 }]

      const buffer = await workbook.xlsx.writeBuffer()

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${reportId}-OPA.xlsx"`,
        },
      })
    }

    if (format === 'zip') {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Group assessments by family
      const byFamily = new Map<string, typeof report.controlAssessments>()
      for (const ctrl of report.controlAssessments) {
        const family = ctrl.family || 'Uncategorized'
        if (!byFamily.has(family)) byFamily.set(family, [])
        byFamily.get(family)!.push(ctrl)
      }

      // Sanitize folder/file names
      const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_').trim()

      for (const [family, controls] of byFamily) {
        const familyFolder = sanitize(family)

        for (const ctrl of controls) {
          const controlFolder = sanitize(`${ctrl.controlId} - ${ctrl.controlTitle}`)
          const basePath = `${familyFolder}/${controlFolder}`

          // Control summary file
          zip.file(`${basePath}/_control-summary.json`, JSON.stringify({
            controlId: ctrl.controlId,
            title: ctrl.controlTitle,
            family: ctrl.family,
            status: ctrl.status,
            assessedAt: ctrl.assessedAt,
            findings: ctrl.findings,
            recommendations: ctrl.recommendations,
            evidenceCount: ctrl.evidenceCollected?.length ?? 0,
          }, null, 2))

          // Individual evidence files
          if (Array.isArray(ctrl.evidenceCollected)) {
            ctrl.evidenceCollected.forEach((ev, idx) => {
              const evName = sanitize(ev.queryId || `evidence-${idx + 1}`)
              zip.file(`${basePath}/${evName}.json`, JSON.stringify({
                queryId: ev.queryId,
                description: ev.queryDescription,
                endpoint: ev.endpoint,
                collectedAt: ev.collectedAt,
                success: ev.success,
                recordCount: ev.recordCount,
                errorMessage: ev.errorMessage ?? null,
                data: ev.rawData,
              }, null, 2))
            })
          }
        }
      }

      // Add a top-level manifest
      zip.file('manifest.json', JSON.stringify({
        reportId: report.reportId,
        framework: report.frameworkName,
        tenant: report.tenantDisplayName,
        generatedAt: new Date().toISOString(),
        totalControls: report.controlAssessments.length,
        families: [...byFamily.keys()],
      }, null, 2))

      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

      return new Response(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${reportId}-evidence.zip"`,
        },
      })
    }

    return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 })

  } catch (err) {
    console.error('[generate-report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Report generation failed' },
      { status: 500 }
    )
  }
}
