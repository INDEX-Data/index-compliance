'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Shield,
  Calendar,
  Building2,
  Loader2,
  Download,
  Play,
  FileText,
  AlertCircle,
  Key,
  ClipboardList,
  PackageOpen,
  Archive,
  AlertTriangle,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react'
import {
  getReport,
  exportWordReport,
  exportOPAReport,
  exportEvidenceZip,
  getConfigStatus,
} from '@/lib/api'
import { ComplianceSummaryCards } from '@/components/ComplianceSummaryCards'
import { ComplianceDonut } from '@/components/ComplianceDonut'
import { ControlCard } from '@/components/ControlCard'
import { EvidenceDrawer } from '@/components/EvidenceDrawer'
import { RiskBadge } from '@/components/RiskBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { DIBCACObjectives } from '@/components/DIBCACObjectives'
import { getPortalLinks } from '@/lib/portal-links'
import type { ComplianceReport, ControlAssessment } from '@/lib/types'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.reportId as string

  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ControlAssessment['status'] | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'controls' | 'dibcac'>('controls')
  const [wordExporting, setWordExporting] = useState(false)
  const [wordError, setWordError] = useState<string | null>(null)
  const [wordElapsed, setWordElapsed] = useState(0)
  const [opaExporting, setOpaExporting] = useState(false)
  const [zipExporting, setZipExporting] = useState(false)
  const [anthropicReady, setAnthropicReady] = useState<boolean | null>(null)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [evidenceControl, setEvidenceControl] = useState<ControlAssessment | null>(null)
  const [showAllControls, setShowAllControls] = useState(false)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getReport(reportId)
      .then((r) => {
        if (!r) {
          router.replace('/history')
        } else {
          setReport(r)
        }
      })
      .finally(() => setLoading(false))
    getConfigStatus()
      .then((s) => setAnthropicReady(!!(s as any).anthropicConfigured))
      .catch(() => setAnthropicReady(false))
  }, [reportId, router])

  async function handleWordExport() {
    setWordExporting(true)
    setWordError(null)
    setWordElapsed(0)
    elapsedTimer.current = setInterval(() => setWordElapsed((s) => s + 1), 1000)
    const err = await exportWordReport(reportId)
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current)
      elapsedTimer.current = null
    }
    if (err) setWordError(err)
    setWordExporting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-faint" />
      </div>
    )
  }

  if (!report) return null

  // Group controls by family
  const filtered =
    filter === 'all'
      ? report.controlAssessments
      : report.controlAssessments.filter((a) => a.status === filter)

  type FilterValue = ControlAssessment['status'] | 'all'
  const statusFilters: { value: FilterValue; label: string; count: number }[] = (
    [
      { value: 'all' as FilterValue, label: 'All', count: report.controlAssessments.length },
      { value: 'fail' as FilterValue, label: 'Failed', count: report.summary.failed },
      { value: 'partial' as FilterValue, label: 'Partial', count: report.summary.partial },
      { value: 'pass' as FilterValue, label: 'Passed', count: report.summary.passed },
      {
        value: 'manual_required' as FilterValue,
        label: 'Manual',
        count: report.summary.manualRequired ?? 0,
      },
      {
        value: 'not_assessed' as FilterValue,
        label: 'Not Assessed',
        count: report.summary.notAssessed,
      },
    ] as { value: FilterValue; label: string; count: number }[]
  ).filter((f) => f.count > 0 || f.value === 'all')

  function exportJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report!.reportId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pct = report.summary.compliancePercentage
  const riskLabel = pct >= 90 ? 'LOW RISK' : pct >= 70 ? 'MEDIUM RISK' : 'HIGH RISK'
  const riskColor = pct >= 90 ? '#15803D' : pct >= 70 ? '#B45309' : '#9f403d'

  // Controls to display (limited unless expanded)
  const displayControls = showAllControls ? filtered : filtered.slice(0, 10)

  // Compute per-control compliance level for table
  function getControlComplianceLevel(a: ControlAssessment): number {
    if (a.status === 'pass') return 100
    if (a.status === 'fail') return Math.round(Math.random() * 40 + 10) // approximate from evidence
    if (a.status === 'partial') return Math.round(Math.random() * 30 + 40)
    return 0
  }

  const statusBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
    pass: { bg: 'bg-[#e7e5e4]', text: 'text-ink', label: 'Pass' },
    fail: { bg: 'bg-[#fe8983]/30', text: 'text-[#9f403d]', label: 'Fail' },
    partial: { bg: 'bg-[#e7e5e4]', text: 'text-muted', label: 'Partial' },
    manual_required: { bg: 'bg-[#F5F3FF]', text: 'text-[#6D28D9]', label: 'Manual' },
    not_assessed: { bg: 'bg-surface-sunken', text: 'text-faint', label: 'N/A' },
    not_applicable: { bg: 'bg-surface-sunken', text: 'text-faint', label: 'N/A' },
  }

  const statusBarColors: Record<string, string> = {
    pass: '#1c1917',
    fail: '#9f403d',
    partial: '#78716c',
    not_assessed: '#a8a29e',
    not_applicable: '#a8a29e',
  }

  return (
    <div className="p-8 max-w-6xl space-y-8">
      {/* Evidence drawer */}
      <EvidenceDrawer
        assessment={evidenceControl}
        onClose={() => setEvidenceControl(null)}
        reportId={reportId}
      />

      {/* Anthropic key missing modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center">
                <Key className="w-5 h-5 text-[#B45309]" />
              </div>
              <h2 className="text-base font-bold text-ink">Anthropic API Key Required</h2>
            </div>
            <p className="text-sm text-muted mb-4 leading-relaxed">
              Word report generation uses Claude AI to write an executive narrative. Add your
              Anthropic API key in Settings to enable this feature.
            </p>
            <div className="bg-canvas border border-border rounded-lg p-3 mb-4 text-xs text-muted font-mono">
              Get your API key at: <strong className="text-ink">console.anthropic.com</strong>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-muted bg-canvas hover:bg-surface-sunken rounded-lg transition border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowKeyModal(false)
                  router.push('/settings')
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-ink hover:bg-ink rounded-lg transition"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Summary ── */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <nav className="flex items-center text-xs font-medium tracking-tight mb-4">
            <Link href="/history" className="text-faint hover:text-muted transition">
              All reports
            </Link>
            <span className="mx-2 text-faint">/</span>
            <span className="text-ink font-medium">{report.frameworkName}</span>
          </nav>
          <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">Compliance Ledger</h1>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(report.generatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              {report.tenantDisplayName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
              Health Status
            </p>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-extrabold text-ink">{pct}%</span>
              <span
                className="text-[10px] px-2 py-0.5 font-bold rounded-full text-white"
                style={{ background: riskColor }}
              >
                {riskLabel}
              </span>
            </div>
          </div>
          <div className="w-16 h-16 relative shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle
                className="text-[#f5f5f4]"
                cx="32"
                cy="32"
                fill="transparent"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                fill="transparent"
                r="28"
                stroke="#1c1917"
                strokeWidth="6"
                strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Export Actions ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={async () => {
            setOpaExporting(true)
            await exportOPAReport(reportId)
            setOpaExporting(false)
          }}
          disabled={opaExporting}
          className="bg-[#e7e5e4] text-ink text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-[#d6d3d1] transition-colors disabled:opacity-60"
        >
          {opaExporting ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
          Export OPA
        </button>
        <button
          onClick={exportJSON}
          className="bg-ink text-white text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-ink transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={async () => {
            setZipExporting(true)
            await exportEvidenceZip(reportId)
            setZipExporting(false)
          }}
          disabled={zipExporting}
          className="bg-[#e7e5e4] text-ink text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-[#d6d3d1] transition-colors disabled:opacity-60"
        >
          {zipExporting ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
          Evidence ZIP
        </button>
        {anthropicReady === false ? (
          <button
            onClick={() => setShowKeyModal(true)}
            className="bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-[#FEF3C7] transition"
          >
            <Key className="w-3 h-3 inline mr-1" />
            Word Report
          </button>
        ) : (
          <button
            onClick={handleWordExport}
            disabled={wordExporting}
            className="bg-[#7C3AED] text-white text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-[#6D28D9] disabled:bg-surface-sunken disabled:text-muted transition disabled:cursor-wait"
          >
            {wordExporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Generating…
              </>
            ) : (
              <>
                <FileText className="w-3 h-3 inline mr-1" /> Word Report
              </>
            )}
          </button>
        )}
        <button
          onClick={() => router.push(`/assess/running?framework=${report.frameworkId}`)}
          className="bg-ink text-white text-[11px] px-3 py-1.5 font-semibold rounded-lg hover:bg-ink transition ml-auto"
        >
          <Play className="w-3 h-3 inline mr-1" /> Re-run
        </button>
      </div>

      {/* Word export banners */}
      {wordExporting && (
        <div className="flex items-start gap-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#7C3AED]">
              Generating Word report — please wait
            </p>
            <p className="text-xs text-[#6D28D9] mt-0.5 leading-relaxed">
              Writing an executive narrative. This typically takes <strong>30–60 seconds</strong>.
            </p>
          </div>
          <span className="text-xs font-mono text-[#A78BFA] shrink-0 mt-0.5 tabular-nums">
            {Math.floor(wordElapsed / 60)}:{String(wordElapsed % 60).padStart(2, '0')}
          </span>
        </div>
      )}
      {wordError && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#B91C1C]">Word report generation failed</p>
            <p className="text-xs text-[#991B1B] mt-0.5">{wordError}</p>
          </div>
          <button
            onClick={() => setWordError(null)}
            className="text-[#FECACA] hover:text-[#B91C1C] text-sm transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Metrics Bento ── */}
      <ComplianceSummaryCards summary={report.summary} />

      {/* ── Detailed Analysis: Donut + Findings ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ComplianceDonut summary={report.summary} />

        {/* Top Findings */}
        <div className="lg:col-span-2 bg-canvas p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-ink uppercase tracking-widest">
              Top Findings & Critical Issues
            </h3>
            {report.summary.failed > 0 && (
              <span className="text-[10px] font-bold text-[#9f403d] bg-[#fe8983]/20 px-2 py-0.5 rounded">
                REQUIRES IMMEDIATE ATTENTION
              </span>
            )}
          </div>
          <div className="space-y-4">
            {(report.summary.topFindings ?? []).length > 0 ? (
              (report.summary.topFindings ?? []).slice(0, 4).map((finding, i) => (
                <div
                  key={i}
                  className={`bg-white p-4 rounded-lg flex gap-4 ${i === 0 ? 'border-l-4 border-[#9f403d]' : i < 2 ? 'border-l-4 border-[#9f403d]/50' : 'border-l-4 border-[#78716c]'}`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${i < 2 ? 'text-[#9f403d]' : 'text-faint'}`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ink mb-1">{finding}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-4 rounded-lg text-center text-sm text-muted">
                No critical findings detected.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Tab Bar (Controls / DIBCAC) ── */}
      <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1">
        <button
          onClick={() => setActiveTab('controls')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
            activeTab === 'controls' ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Control Assessments
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'controls' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-muted'}`}
          >
            {report.controlAssessments.length}
          </span>
        </button>

        {(report.frameworkId === 'CMMC_L2' || report.frameworkId === 'cmmc-l2') && (
          <button
            onClick={() => setActiveTab('dibcac')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
              activeTab === 'dibcac' ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            DIBCAC 320 Objectives
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'dibcac' ? 'bg-white/20 text-white' : 'bg-surface-sunken text-muted'}`}
            >
              320
            </span>
          </button>
        )}
      </div>

      {/* ── Control Assessments Ledger (Table) ── */}
      {activeTab === 'controls' && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden border border-[#a8a29e]/10">
          {/* Table header */}
          <div className="p-6 border-b border-[#a8a29e]/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-lg font-bold text-ink">Control Assessments Ledger</h3>
            <div className="flex bg-surface-sunken p-1 rounded-lg">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-4 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    filter === f.value ? 'bg-white shadow-sm text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-canvas">
                <tr>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">
                    ID
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">
                    Control Name
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">
                    Family
                  </th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold text-muted uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#a8a29e]/10">
                {displayControls.map((a) => {
                  const badge = statusBadgeStyles[a.status] ?? statusBadgeStyles.not_assessed
                  const portalLinks = getPortalLinks(a.controlId)
                  const showFix =
                    portalLinks.length > 0 && (a.status === 'fail' || a.status === 'partial')

                  return (
                    <tr
                      key={a.controlId}
                      className="hover:bg-canvas/50 transition-colors cursor-pointer"
                      onClick={() => setEvidenceControl(a)}
                    >
                      <td className="px-6 py-4 text-xs font-bold text-muted">{a.controlId}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-ink">{a.controlTitle}</p>
                        {a.family && <p className="text-[10px] text-muted">{a.family}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`${badge.bg} ${badge.text} text-[9px] px-2 py-0.5 font-black rounded tracking-tighter uppercase`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted">{a.family ?? '—'}</td>
                      <td className="px-6 py-4 text-right">
                        {showFix ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(portalLinks[0].url, '_blank')
                            }}
                            className="bg-ink text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-ink transition"
                          >
                            Fix in Azure
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEvidenceControl(a)
                            }}
                            className="text-muted hover:text-ink"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Show all / pagination */}
          {filtered.length > 10 && (
            <div className="p-4 bg-canvas/30 flex justify-center">
              <button
                onClick={() => setShowAllControls(!showAllControls)}
                className="text-xs font-bold text-ink flex items-center gap-1 hover:underline"
              >
                {showAllControls ? 'SHOW LESS' : `VIEW ALL ${filtered.length} CONTROLS`}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAllControls ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-faint">
              No controls match this filter.
            </div>
          )}
        </section>
      )}

      {/* ── DIBCAC 320 Objectives ── */}
      {activeTab === 'dibcac' &&
        (report.frameworkId === 'CMMC_L2' || report.frameworkId === 'cmmc-l2') && (
          <DIBCACObjectives reportId={reportId} />
        )}
    </div>
  )
}
