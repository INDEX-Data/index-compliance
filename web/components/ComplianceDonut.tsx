'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ComplianceSummary } from '@/lib/types'

const COLORS: Record<string, string> = {
  Passed:         '#1c1917',
  Partial:        '#78716c',
  Failed:         '#9f403d',
  'Not Assessed': '#a8a29e',
}

interface Props { summary: ComplianceSummary }

export function ComplianceDonut({ summary }: Props) {
  const { passed, partial, failed, notAssessed, totalControls } = summary

  const data = [
    { name: 'Passed',       value: passed       },
    { name: 'Partial',      value: partial      },
    { name: 'Failed',       value: failed       },
    { name: 'Not Assessed', value: notAssessed  },
  ].filter(d => d.value > 0)

  return (
    <div className="lg:col-span-1 bg-[#fafaf9] p-6 rounded-xl flex flex-col items-center justify-center text-center">
      <h3 className="text-sm font-bold text-[#1c1917] uppercase tracking-widest mb-8">Status Distribution</h3>

      <div className="relative w-48 h-48 mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid #e7e5e4',
                background: '#FFFFFF',
                color: '#1c1917',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
              }}
              formatter={(value: number, name: string) => [`${value} controls`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-[#1c1917]">{totalControls}</span>
          <span className="text-[10px] text-[#44403c] font-bold uppercase">Total Controls</span>
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-4">
        {[
          { key: 'Passed',       color: '#1c1917', val: passed,      pct: Math.round((passed / totalControls) * 100) },
          { key: 'Partial',      color: '#78716c', val: partial,     pct: Math.round((partial / totalControls) * 100) },
          { key: 'Failed',       color: '#9f403d', val: failed,      pct: Math.round((failed / totalControls) * 100) },
          { key: 'Pending',      color: '#a8a29e', val: notAssessed, pct: Math.round((notAssessed / totalControls) * 100) },
        ].map(({ key, color, pct }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs text-[#44403c]">{key} ({pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
