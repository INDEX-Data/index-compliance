'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Calendar, Building2, Loader2, Download, Play, FileText, AlertCircle, Key, ClipboardList } from 'lucide-react'
import { getReport, exportWordReport, getConfigStatus } from '@/lib/api'
import { ComplianceSummaryCards } from '@/components/ComplianceSummaryCards'
import { ComplianceDonut } from '@/components/ComplianceDonut'
import { ControlCard } from '@/components/ControlCard'
import { EvidenceDrawer } from '@/components/EvidenceDrawer'
import { RiskBadge } from '@/components/RiskBadge'
import { DIBCACObjectives } from '@/components/DIBCACObjectives'
import type { ComplianceReport, ControlAssessment } from '@/lib/types'

export default function ReportPage() {
  const params   = useParams()
  const router   = useRouter()
  const reportId = params.reportId as string

  const [report, setReport]               = useState<ComplianceReport | null>(null)
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState<ControlAssessment['status'] | 'all'>('all')
  const [activeTab, setActiveTab]         = useState<'controls' | 'dibcac'>('controls')
  const [wordExporting, setWordExporting] = useState(false)
  const [wordError, setWordError]         = useState<string | null>(null)
  const [wordElapsed, setWordElapsed]     = useState(0)
  const [anthropicReady, setAnthropicReady]     = useState<boolean | null>(null)
  const [showKeyModal, setShowKeyModal]         = useState(false)
  const [evidenceControl, setEvidenceControl]   = useState<ControlAssessment | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getReport(reportId)
      .then(r => { if (!r) { router.replace('/history'); } else { setReport(r) } })
      .finally(() => setLoading(false))
    getConfigStatus()
      .then(s => setAnthropicReady(!!(s as any).anthropicConfigured))
      .catch(() => setAnthropicReady(false))
  }, [reportId, router])

  async function handleWordExport() {
    setWordExporting(true)
    setWordError(null)
    setWordElapsed(0)
    elapsedTimer.current = setInterval(() => setWordElapsed(s => s + 1), 1000)
    const err = await exportWordReport(reportId)
    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null }
    if (err) setWordError(err)
    setWordExporting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-[#BBBBBB]" />
      </div>
    )
  }

  if (!report) return null

  // Group controls by family
  const grouped: Record<string, ControlAssessment[]> = {}
  for (const a of report.controlAssessments) {
    if (filter !== 'all' && a.status !== filter) continue
    const key = a.family ?? a.frameworkId ?? 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  }
  const families = Object.keys(grouped).sort()

  type FilterValue = ControlAssessment['status'] | 'all'
  const statusFilters: { value: FilterValue; label: string; count: number }[] = (
    [
      { value: 'all'          as FilterValue, label: 'All',         count: report.controlAssessments.length },
      { value: 'fail'         as FilterValue, label: 'Failed',      count: report.summary.failed },
      { value: 'partial'      as FilterValue, label: 'Partial',     count: report.summary.partial },
      { value: 'pass'         as FilterValue, label: 'Passed',      count: report.summary.passed },
      { value: 'not_assessed' as FilterValue, label: 'Not Assessed',count: report.summary.notAssessed },
    ] as { value: FilterValue; label: string; count: number }[]
  ).filter(f => f.count > 0 || f.value === 'all')

  function exportJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${report!.reportId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pct = report.summary.compliancePercentage
  const scoreColor = pct >= 90 ? '#15803D' : pct >= 70 ? '#B45309' : '#B91C1C'

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Evidence drawer — rendered outside the content flow so it overlays everything */}
      <EvidenceDrawer
        assessment={evidenceControl}
        onClose={() => setEvidenceControl(null)}
      />

      {/* Back + actions */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#999999] hover:text-[#0A0A0A] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All reports
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#555555] bg-white hover:bg-[#FAFAFA] border border-[#E8E8E8] px-3 py-2 rounded-lg transition shadow-card"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>

          {/* Word report button */}
          {anthropicReady === false ? (
            <button
              onClick={() => setShowKeyModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] hover:bg-[#FEF3C7] px-3 py-2 rounded-lg transition"
              title="Anthropic API key required"
            >
              <Key className="w-3.5 h-3.5" />
              Word Report
            </button>
          ) : (
            <button
              onClick={handleWordExport}
              disabled={wordExporting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-[#F3F4F6] disabled:text-[#999999] disabled:cursor-wait px-3 py-2 rounded-lg transition"
            >
              {wordExporting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                : <><FileText className="w-3.5 h-3.5" /> Word Report</>
              }
            </button>
          )}

          <button
            onClick={() => router.push(`/assess/running?framework=${report.frameworkId}`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A0A0A] hover:bg-[#111111] px-3 py-2 rounded-lg transition"
          >
            <Play className="w-3.5 h-3.5" />
            Re-run
          </button>
        </div>
      </div>

      {/* Word export in-progress banner */}
      {wordExporting && (
        <div className="flex items-start gap-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl px-4 py-3 mb-5">
          <Loader2 className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#7C3AED]">Generating Word report — please wait</p>
            <p className="text-xs text-[#6D28D9] mt-0.5 leading-relaxed">
              We are writing an executive narrative from your assessment results and building the .docx file.
              This typically takes <strong>30–60 seconds</strong>.
            </p>
          </div>
          <span className="text-xs font-mono text-[#A78BFA] shrink-0 mt-0.5 tabular-nums">
            {Math.floor(wordElapsed / 60)}:{String(wordElapsed % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Word export error */}
      {wordError && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#B91C1C]">Word report generation failed</p>
            <p className="text-xs text-[#991B1B] mt-0.5">{wordError}</p>
          </div>
          <button onClick={() => setWordError(null)} className="text-[#FECACA] hover:text-[#B91C1C] text-sm transition">✕</button>
        </div>
      )}

      {/* Anthropic key missing modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center">
                <Key className="w-5 h-5 text-[#B45309]" />
              </div>
              <h2 className="text-base font-bold text-[#0A0A0A]">Anthropic API Key Required</h2>
            </div>
            <p className="text-sm text-[#555555] mb-4 leading-relaxed">
              Word report generation uses Claude AI to write an executive narrative. Add your Anthropic API key in Settings to enable this feature.
            </p>
            <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-lg p-3 mb-4 text-xs text-[#999999] font-mono">
              Get your API key at: <strong className="text-[#0A0A0A]">console.anthropic.com</strong>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[#555555] bg-[#FAFAFA] hover:bg-[#F3F3F3] rounded-lg transition border border-[#E8E8E8]"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowKeyModal(false); router.push('/settings') }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-[#111111] rounded-lg transition"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report header card */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-6 mb-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#FAFAFA] border border-[#E8E8E8] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[#999999]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-[18px] font-bold text-[#0A0A0A]">{report.frameworkName}</h1>
              <RiskBadge score={report.summary.riskScore} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#999999]">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {report.tenantDisplayName}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(report.generatedAt).toLocaleString()}
              </span>
              <span className="font-mono text-[10px] text-[#BBBBBB]">{report.reportId}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold leading-none tabular-nums" style={{ fontSize: 40, color: scoreColor }}>
              {pct}
              <span className="text-xl text-[#D4D4D4] font-medium">%</span>
            </div>
            <div className="text-[11px] text-[#999999] mt-1">Compliance Score</div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <ComplianceSummaryCards summary={report.summary} className="mb-5" />

      {/* Donut + top findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ComplianceDonut summary={report.summary} />

        {report.summary.topFindings.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E8E8E8] p-5 shadow-card">
            <p className="text-[10px] font-semibold text-[#999999] uppercase tracking-widest mb-3">Top Findings</p>
            <ul className="space-y-2.5">
              {report.summary.topFindings.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#1A1A1A]">
                  <span className="w-5 h-5 rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-white border border-[#E8E8E8] rounded-xl p-1 shadow-card mb-5">
        <button
          onClick={() => setActiveTab('controls')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
            activeTab === 'controls'
              ? 'bg-[#0A0A0A] text-white shadow-sm'
              : 'text-[#999999] hover:text-[#0A0A0A]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Control Assessments
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'controls' ? 'bg-white/20 text-white' : 'bg-[#F3F3F3] text-[#999999]'}`}>
            {report.controlAssessments.length}
          </span>
        </button>

        {report.frameworkId === 'CMMC_L2' && (
          <button
            onClick={() => setActiveTab('dibcac')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
              activeTab === 'dibcac'
                ? 'bg-[#0A0A0A] text-white shadow-sm'
                : 'text-[#999999] hover:text-[#0A0A0A]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            DIBCAC 320 Objectives
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'dibcac' ? 'bg-white/20 text-white' : 'bg-[#F3F3F3] text-[#999999]'}`}>
              320
            </span>
          </button>
        )}
      </div>

      {/* Controls section */}
      {activeTab === 'controls' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold text-[#0A0A0A] uppercase tracking-widest">Control Assessments</h2>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-white border border-[#E8E8E8] rounded-lg p-1 shadow-card">
              {statusFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition
                    ${filter === f.value
                      ? 'bg-[#0A0A0A] text-white shadow-sm'
                      : 'text-[#999999] hover:text-[#0A0A0A]'
                    }`}
                >
                  {f.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold
                    ${filter === f.value ? 'bg-white/20 text-white' : 'bg-[#F3F3F3] text-[#999999]'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {families.length === 0 ? (
            <div className="text-center py-12 text-[#BBBBBB] text-sm bg-white rounded-xl border border-[#E8E8E8] shadow-card">
              No controls match this filter.
            </div>
          ) : (
            <div className="space-y-6">
              {families.map(family => (
                <div key={family}>
                  <h3 className="text-[10px] font-bold text-[#BBBBBB] uppercase tracking-widest mb-3 px-1">
                    {family}
                  </h3>
                  <div className="space-y-2">
                    {grouped[family].map(a => (
                      <ControlCard
                        key={a.controlId}
                        assessment={a}
                        onViewEvidence={setEvidenceControl}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIBCAC 320 Objectives section */}
      {activeTab === 'dibcac' && report.frameworkId === 'CMMC_L2' && (
        <DIBCACObjectives reportId={reportId} />
      )}
    </div>
  )
}
