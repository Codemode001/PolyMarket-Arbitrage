'use client'

import { useState } from 'react'
import { ExecuteDialog } from './ExecuteDialog'

export interface OpportunityRow {
  id: string
  market_id: string
  question: string
  price_a: number
  price_b: number
  combined_price: number
  expected_profit_pct: number
  status: string
  created_at: string
}

function ProfitBadge({ pct }: { pct: number }) {
  const display = (pct * 100).toFixed(2) + '%'
  if (pct > 0.02) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-900 text-emerald-300">
        +{display}
      </span>
    )
  }
  if (pct > 0.01) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-900 text-yellow-300">
        +{display}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-900/60 text-red-400">
      +{display}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
          found
        </span>
      )
    case 'executing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-900/60 text-yellow-300">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          executing
        </span>
      )
    case 'executed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-900/60 text-emerald-300">
          executed
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-900/60 text-red-400">
          failed
        </span>
      )
    case 'missed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-600">
          missed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-500">
          {status}
        </span>
      )
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

interface Props {
  opportunities: OpportunityRow[]
  loading?: boolean
  onStatusChange?: (id: string, status: string) => void
}

export function OpportunityTable({ opportunities, loading, onStatusChange }: Props) {
  const [dialogOpp, setDialogOpp] = useState<OpportunityRow | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">
        Scanning markets…
      </div>
    )
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">
        No arbitrage opportunities found yet. Click &quot;Scan Now&quot; to search.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-4 font-medium">Market</th>
              <th className="text-right py-3 px-3 font-medium w-20">YES Ask</th>
              <th className="text-right py-3 px-3 font-medium w-20">NO Ask</th>
              <th className="text-right py-3 px-3 font-medium w-24">Combined</th>
              <th className="text-right py-3 px-3 font-medium w-24">Profit %</th>
              <th className="text-center py-3 px-3 font-medium w-24">Status</th>
              <th className="text-right py-3 px-3 font-medium w-24">Found</th>
              <th className="text-center py-3 px-4 font-medium w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => {
              const canExecute = o.status === 'pending'
              return (
                <tr
                  key={o.id}
                  className="border-b border-zinc-900 hover:bg-zinc-900/50 bg-emerald-950/10 transition-colors"
                >
                  <td className="py-3 px-4 text-zinc-200 max-w-xs">
                    <div className="truncate" title={o.question}>
                      {o.question}
                    </div>
                    <div className="text-zinc-600 text-xs mt-0.5 font-mono">
                      {o.market_id.slice(0, 12)}…
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                    {(o.price_a * 100).toFixed(1)}¢
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                    {(o.price_b * 100).toFixed(1)}¢
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">
                    {(o.combined_price * 100).toFixed(1)}¢
                  </td>
                  <td className="py-3 px-3 text-right">
                    <ProfitBadge pct={o.expected_profit_pct} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-3 px-3 text-right text-zinc-500 text-xs">
                    {timeAgo(o.created_at)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {canExecute ? (
                      <button
                        onClick={() => setDialogOpp(o)}
                        className="px-3 py-1 text-xs bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 rounded text-emerald-200 font-bold transition-colors"
                      >
                        Execute
                      </button>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dialogOpp && (
        <ExecuteDialog
          opportunity={dialogOpp}
          onClose={() => setDialogOpp(null)}
          onExecuted={(id) => {
            onStatusChange?.(id, 'executed')
            setDialogOpp(null)
          }}
        />
      )}
    </>
  )
}
