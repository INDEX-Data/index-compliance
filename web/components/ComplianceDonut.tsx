'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ComplianceSummary } from '@/lib/types'

const COLORS: Record<string, string> = {
  Passed:         '#15803D',
  Partial:        '#B45309',
  Failed:         '#B91C1C',
  'Not Assessed': '#D1D5DB',
}

interface Props { summary: ComplianceSummary }

export function ComplianceDonut({ summary }: Props) {
  const { passed, partial, failed, notAssessed } = summary

  const data = [
    { name: 'Passed',       value: passed       },
    { name: 'Partial',      value: partial      },
    { name: 'Failed',       value: failed       },
    { name: 'Not Assessed', value: notAssessed  },
  ].filter(d => d.value > 0)

  return (
    <div className="bg-white rounded-xl border border-[#E9E5DD] p-5">
      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Control Breakdown</p>
      <div className="flex items-center gap-5">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={56}
              paddingAngle={3}
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
                border: '1px solid #E9E5DD',
                background: '#FFFFFF',
                color: '#18181B',
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
              }}
              formatter={(value: number, name: string) => [`${value} controls`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {[
            { key: 'Passed',       color: '#15803D', val: passed       },
            { key: 'Partial',      color: '#B45309', val: partial      },
            { key: 'Failed',       color: '#B91C1C', val: failed       },
            { key: 'Not Assessed', color: '#D1D5DB', val: notAssessed  },
          ].map(({ key, color, val }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-[#6B7280] flex-1">{key}</span>
              <span className="text-[11px] font-semibold text-[#18181B]">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
