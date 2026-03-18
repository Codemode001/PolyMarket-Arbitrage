'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Nav } from '@/components/shared/Nav'

interface BetRow {
  id: string
  pnl: number | null
  created_at: string
}

interface OppRow {
  id: string
  type: string
  status: string
  expected_profit_pct: number
  market_id: string
  question: string
  created_at: string
}

interface ExecRow {
  id: string
  expected_profit_usdc: number | null
  size_usdc: number | null
  market_id: string
  created_at: string
}

interface CumulativePoint {
  date: string
  cumPnl: number
}

interface PieSlice {
  name: string
  value: number
}

const PIE_COLORS = ['#34d399', '#fb923c', '#60a5fa', '#a78bfa']

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-5">
      <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black font-mono ${valueColor ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [bets, setBets] = useState<BetRow[]>([])
  const [opps, setOpps] = useState<OppRow[]>([])
  const [execs, setExecs] = useState<ExecRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [betsRes, oppsRes, execsRes] = await Promise.all([
        fetch('/api/bets').then((r) => r.json()).catch(() => ({ bets: [] })),
        fetch('/api/arb/opportunities').then((r) => r.json()).catch(() => ({ opportunities: [] })),
        fetch('/api/arb/executions').then((r) => r.json()).catch(() => ({ executions: [] })),
      ])
      setBets(betsRes.bets ?? [])
      setOpps(oppsRes.opportunities ?? [])
      setExecs(execsRes.executions ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Cumulative P&L line ──────────────────────────────────────────────────
  const cumulativeData: CumulativePoint[] = []
  const sortedBets = [...bets]
    .filter((b) => b.pnl != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  let running = 0
  for (const b of sortedBets) {
    running += b.pnl ?? 0
    cumulativeData.push({
      date: new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cumPnl: parseFloat(running.toFixed(4)),
    })
  }

  // ── Arb type breakdown ───────────────────────────────────────────────────
  const typeCounts: Record<string, number> = {}
  for (const o of opps) {
    typeCounts[o.type] = (typeCounts[o.type] ?? 0) + 1
  }
  const pieData: PieSlice[] = Object.entries(typeCounts).map(([name, value]) => ({
    name: name === 'yes_no' ? 'YES/NO' : name === 'logical' ? 'Logical' : name,
    value,
  }))

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalOpps = opps.length
  const executed = opps.filter((o) => o.status === 'executed').length
  const fillRate = totalOpps > 0 ? ((executed / totalOpps) * 100).toFixed(1) : '—'

  const totalPnl = bets.reduce((s, b) => s + (b.pnl ?? 0), 0)
  const pnlBets = bets.filter((b) => b.pnl != null)
  const avgPnl = pnlBets.length > 0 ? totalPnl / pnlBets.length : 0

  // Best performing market by total pnl
  const marketPnl: Record<string, { question: string; pnl: number }> = {}
  for (const o of opps) {
    if (!marketPnl[o.market_id]) {
      marketPnl[o.market_id] = { question: o.question, pnl: 0 }
    }
  }
  for (const b of bets) {
    if (marketPnl[b.id]) {
      marketPnl[b.id].pnl += b.pnl ?? 0
    }
  }
  const bestMarket = Object.values(marketPnl).sort((a, b) => b.pnl - a.pnl)[0]

  const pnlColor =
    totalPnl > 0 ? 'text-emerald-400' : totalPnl < 0 ? 'text-red-400' : 'text-zinc-400'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <Nav subtitle="Performance Analytics" />

      <main className="px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Fill Rate"
            value={fillRate === '—' ? '—' : `${fillRate}%`}
            sub={`${executed} executed / ${totalOpps} found`}
          />
          <StatCard
            label="Net P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
            valueColor={pnlColor}
          />
          <StatCard
            label="Avg Profit / Trade"
            value={`${avgPnl >= 0 ? '+' : ''}$${avgPnl.toFixed(4)}`}
            sub={`over ${pnlBets.length} bet${pnlBets.length !== 1 ? 's' : ''}`}
            valueColor={avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <StatCard
            label="Best Market"
            value={bestMarket ? `+$${bestMarket.pnl.toFixed(2)}` : '—'}
            sub={bestMarket?.question?.slice(0, 30) + (bestMarket && bestMarket.question.length > 30 ? '…' : '') || undefined}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-zinc-600 text-sm">
            Loading analytics…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cumulative P&L chart — spans 2 cols */}
            <div className="lg:col-span-2 border border-zinc-800 rounded-xl bg-zinc-900/40 p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">
                Cumulative P&L
              </p>
              {cumulativeData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-zinc-700 text-sm">
                  No resolved bets yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={cumulativeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={{ stroke: '#27272a' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: 6,
                        color: '#e4e4e7',
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                      formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Cumulative P&L']}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumPnl"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#34d399' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Arb type pie chart */}
            <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">
                Arb Type Breakdown
              </p>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-zinc-700 text-sm">
                  No data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(v) => (
                        <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>
                      )}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: 6,
                        color: '#e4e4e7',
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Executions table */}
        {execs.length > 0 && (
          <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
            <div className="border-b border-zinc-800 px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest">
              Recent Executions
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-5 font-medium">Market</th>
                    <th className="text-right py-3 px-4 font-medium w-28">Size</th>
                    <th className="text-right py-3 px-4 font-medium w-28">Expected Profit</th>
                    <th className="text-right py-3 px-5 font-medium w-36">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {execs.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                      <td className="py-3 px-5 text-zinc-200 max-w-xs">
                        <div className="truncate">{e.market_id.slice(0, 16)}…</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-300">
                        ${(e.size_usdc ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        +${(e.expected_profit_usdc ?? 0).toFixed(4)}
                      </td>
                      <td className="py-3 px-5 text-right text-zinc-500 text-xs">
                        {new Date(e.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
