'use client'

import { useEffect, useState } from 'react'
import { X, Layers, Wifi, Settings2, FileText } from 'lucide-react'
import { getClientScoping, saveClientScoping } from '@/lib/api'

interface Props {
  clientId: string
  clientName: string
  onClose: () => void
}

const ASSET_CLASSES = [
  {
    id: 'cui',
    label: 'CUI / Controlled Unclassified Information',
    description: 'Documents, data stores, and systems that process Controlled Unclassified Information in Microsoft 365',
    icon: FileText,
    required: true,
  },
  {
    id: 'spa',
    label: 'Security Protection Assets (SPA)',
    description: 'Identity systems, MFA, endpoint management, and security tooling (Entra ID, Intune, Defender)',
    icon: Settings2,
    required: true,
  },
  {
    id: 'iot',
    label: 'IoT / Connected Devices',
    description: 'Network-connected sensors, cameras, building automation, or other IoT devices on the CUI network',
    icon: Wifi,
    required: false,
  },
  {
    id: 'ot_scada',
    label: 'OT / SCADA / Industrial Control Systems',
    description: 'Operational technology, PLCs, SCADA systems, or industrial control networks',
    icon: Layers,
    required: false,
  },
]

export function AssetScopingModal({ clientId, clientName, onClose }: Props) {
  const [scoping,  setScoping]  = useState<Record<string, boolean>>({ cui: true, spa: true, iot: false, ot_scada: false })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    getClientScoping(clientId)
      .then(setScoping).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  async function handleSave() {
    setSaving(true)
    await saveClientScoping(clientId, scoping)
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const inScope    = Object.values(scoping).filter(Boolean).length
  const outOfScope = Object.values(scoping).filter(v => !v).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(28,29,31,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#eeeff1]">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1c1d1f]">Asset Scoping</h2>
            <p className="text-[11px] text-[#6f7988] mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="text-[#a4adba] hover:text-[#505967] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-[12px] text-[#6f7988] mb-4 leading-relaxed">
            Select the asset classes in scope for this assessment. Controls related to out-of-scope asset classes will be suppressed, reducing noise and increasing signal.
          </p>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-[72px] bg-[#f3f4f6] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {ASSET_CLASSES.map(cls => {
                const Icon    = cls.icon
                const checked = scoping[cls.id] ?? false
                return (
                  <div
                    key={cls.id}
                    onClick={() => !cls.required && setScoping(prev => ({ ...prev, [cls.id]: !prev[cls.id] }))}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                      cls.required ? 'cursor-default opacity-75' : 'cursor-pointer'
                    } ${
                      checked
                        ? 'border-[#1c1d1f] bg-[rgba(28,29,31,0.03)]'
                        : 'border-[#e4e7ec] hover:border-[#c8ccd4]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      checked ? 'bg-[#1c1d1f]' : 'bg-[#f3f4f6]'
                    }`}>
                      <Icon className={`w-4 h-4 ${checked ? 'text-white' : 'text-[#a4adba]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[#1c1d1f]">{cls.label}</p>
                        {cls.required && (
                          <span className="text-[10px] text-[#6f7988] bg-[#f3f4f6] px-1.5 py-0.5 rounded font-medium">Required</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6f7988] mt-0.5 leading-relaxed">{cls.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                      checked ? 'bg-[#1c1d1f] border-[#1c1d1f]' : 'border-[#c8ccd4]'
                    }`}>
                      {checked && <div className="w-1.5 h-1 border-b-2 border-l-2 border-white transform -rotate-45 -translate-y-[1px]" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && (
            <div className="mt-4 p-3 bg-[#fafafa] rounded-lg border border-[#f3f4f6] flex items-center justify-between">
              <p className="text-[12px] text-[#505967]">
                <span className="font-semibold text-[#1c1d1f]">{inScope}</span> asset class{inScope !== 1 ? 'es' : ''} in scope
                {outOfScope > 0 && <span className="text-[#a4adba]"> · {outOfScope} suppressed</span>}
              </p>
              {outOfScope > 0 && (
                <p className="text-[11px] text-[#6f7988]">Irrelevant controls will be hidden</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#eeeff1]">
          <button onClick={onClose} className="text-[13px] font-medium text-[#505967] hover:text-[#1c1d1f] transition-colors px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="text-[13px] font-medium text-white px-5 py-2.5 rounded-lg transition-colors"
            style={{ background: saved ? '#0eb472' : '#202124' }}
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Scoping'}
          </button>
        </div>
      </div>
    </div>
  )
}
