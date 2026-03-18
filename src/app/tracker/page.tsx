'use client'

import { useEffect, useState } from 'react'
import { Nav } from '@/components/shared/Nav'
import { ProfitBadge } from '@/components/shared/ProfitBadge'

interface BetRow {
  id: string
  market_id: string
  question: string
  side: string
  amount_usdc: number
  price: number
  size: number
  status: string
  pnl: number | null
  created_at: string
}

type SortKey = 'created_at' | 'amount_usdc' | 'pnl' | 'status'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   'bg-zinc-800 text-zinc-400',
    placed:    'bg-blue-900/60 text-blue-400',
    filled:    'bg-blue-900/60 text-blue-400',
    won:       'bg-emerald-900/60 text-emerald-400',
    lost:      'bg-red-900/50 text-red-400',
    cancelled: 'bg-yellow-900/50 text-yellow-400',
    partial_rollback: 'bg-orange-900/50 text-orange-400',
  }
  const cls = styles[status] ?? 'bg-zinc-800 text-zinc-500'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${cls}`}>
      {status}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-5">
      <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-black font-mono text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function TrackerPage() {
  const [bets, setBets] = useState<BetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    fetch('/api/bets')
      .then((r) => r.json())
      .then((j) => setBets(j.bets ?? []))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sorted = [...bets].sort((a, b) => {
    let av: number | string = a[sortKey] ?? 0
    let bv: number | string = b[sortKey] ?? 0
    if (sortKey === 'created_at') {
      av = new Date(a.created_at).getTime()
      bv = new Date(b.created_at).getTime()
    }
    if (av < bv) return sortAsc ? -1 : 1
    if (av > bv) return sortAsc ? 1 : -1
    return 0
  })

  // Stats
  const totalBets = bets.length
  const resolved = bets.filter((b) => b.status === 'won' || b.status === 'lost')
  const wins = bets.filter((b) => b.status === 'won').length
  const winRate = resolved.length > 0 ? ((wins / resolved.length) * 100).toFixed(1) : '—'
  const totalPnl = bets.reduce((sum, b) => sum + (b.pnl ?? 0), 0)
  const totalVolume = bets.reduce((sum, b) => sum + (b.amount_usdc ?? 0), 0)

  const pnlColor = totalPnl > 0 ? 'text-emerald-400' : totalPnl < 0 ? 'text-red-400' : 'text-zinc-400'

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-zinc-700 ml-1">↕</span>
    return <span className="text-zinc-400 ml-1">{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <Nav subtitle="Execution History & P&L" />

      <main className="px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Bets" value={String(totalBets)} />
          <StatCard
            label="Win Rate"
            value={winRate === '—' ? '—' : `${winRate}%`}
            sub={`${wins} wins / ${resolved.length} resolved`}
          />
          <StatCard
            label="Total P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
          />
          <StatCard
            label="Total Volume"
            value={`$${totalVolume.toFixed(2)}`}
          />
        </div>

        {/* Bet table */}
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest">
            Bet History
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
              Loading bets…
            </div>
          ) : bets.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
              No bets placed yet. Execute an opportunity to start tracking.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-5 font-medium">Market</th>
                    <th className="text-center py-3 px-3 font-medium w-16">Dir</th>
                    <th
                      className="text-right py-3 px-3 font-medium w-28 cursor-pointer hover:text-zinc-300"
                      onClick={() => toggleSort('amount_usdc')}
                    >
                      Amount <SortArrow col="amount_usdc" />
                    </th>
                    <th className="text-right py-3 px-3 font-medium w-24">Entry</th>
                    <th
                      className="text-center py-3 px-3 font-medium w-28 cursor-pointer hover:text-zinc-300"
                      onClick={() => toggleSort('status')}
                    >
                      Status <SortArrow col="status" />
                    </th>
                    <th
                      className="text-right py-3 px-3 font-medium w-28 cursor-pointer hover:text-zinc-300"
                      onClick={() => toggleSort('pnl')}
                    >
                      P&L <SortArrow col="pnl" />
                    </th>
                    <th
                      className="text-right py-3 px-5 font-medium w-36 cursor-pointer hover:text-zinc-300"
                      onClick={() => toggleSort('created_at')}
                    >
                      Date <SortArrow col="created_at" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="py-3 px-5 text-zinc-200 max-w-xs">
                        <div className="truncate" title={b.question}>{b.question}</div>
                        <div className="text-zinc-600 text-xs mt-0.5">{b.market_id.slice(0, 10)}…</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-bold ${b.side === 'YES' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {b.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        ${b.amount_usdc?.toFixed(2) ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-400">
                        {b.price != null ? `${(b.price * 100).toFixed(1)}¢` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <ProfitBadge value={b.pnl} />
                      </td>
                      <td className="py-3 px-5 text-right text-zinc-500 text-xs">
                        {new Date(b.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals footer when data present */}
        {bets.length > 0 && (
          <div className="flex justify-end">
            <span className={`text-sm font-mono font-bold ${pnlColor}`}>
              Net P&L: {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(4)}
            </span>
          </div>
        )}
      </main>
    </div>
  )
}
