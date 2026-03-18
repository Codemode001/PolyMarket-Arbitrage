'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OpportunityTable, OpportunityRow } from '@/components/opportunities/OpportunityTable'
import { Nav } from '@/components/shared/Nav'

interface MarketRow {
  condition_id: string
  question: string
  yes_price: number | null
  no_price: number | null
  volume: number | null
  end_date: string | null
  active: boolean
  category: string | null
}

function PriceBadge({ price }: { price: number | null }) {
  if (price == null) return <span className="text-zinc-600">—</span>
  const pct = (price * 100).toFixed(1)
  const color =
    price >= 0.7 ? 'text-emerald-400' : price >= 0.4 ? 'text-yellow-400' : 'text-red-400'
  return <span className={color}>{pct}¢</span>
}

function formatVolume(v: number | null) {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function formatEndDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function Home() {
  const [markets, setMarkets] = useState<MarketRow[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([])
  const [loadingMarkets, setLoadingMarkets] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<Date | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchMarkets() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('markets')
      .select('condition_id, question, yes_price, no_price, volume, end_date, active, category')
      .eq('active', true)
      .eq('closed', false)
      .order('volume', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Failed to load markets:', error.message)
    } else {
      setMarkets((data as MarketRow[]) ?? [])
    }
    setLoadingMarkets(false)
  }

  async function fetchOpportunities() {
    const supabase = createClient()
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString() // last 5 min
    const { data, error } = await supabase
      .from('arb_opportunities')
      .select('id, market_id, price_a, price_b, combined_price, expected_profit_pct, status, created_at, markets!arb_opportunities_market_id_a_fkey(question)')
      .gte('created_at', cutoff)
      .order('expected_profit_pct', { ascending: false })
      .limit(50)

    if (!error && data) {
      const rows: OpportunityRow[] = data.map((d: {
        id: string
        market_id: string
        price_a: number
        price_b: number
        combined_price: number
        expected_profit_pct: number
        status: string
        created_at: string
        markets: { question: string }[] | null
      }) => ({
        id: d.id,
        market_id: d.market_id,
        question: (Array.isArray(d.markets) ? d.markets[0]?.question : null) ?? d.market_id,
        price_a: d.price_a,
        price_b: d.price_b,
        combined_price: d.combined_price,
        expected_profit_pct: d.expected_profit_pct,
        status: d.status,
        created_at: d.created_at,
      }))
      setOpportunities(rows)
    }
  }

  async function syncMarkets() {
    setSyncing(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/markets/sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setStatusMsg(`Synced ${json.synced} markets`)
        await fetchMarkets()
      } else {
        setStatusMsg(`Sync error: ${json.error}`)
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setSyncing(false)
  }

  async function runScan() {
    setScanning(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/scanner', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setLastScan(new Date())
        setStatusMsg(`Scan complete — ${json.count} opportunity${json.count !== 1 ? 'ies' : 'y'} found`)
        await fetchOpportunities()
      } else {
        setStatusMsg(`Scan error: ${json.error}`)
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setScanning(false)
  }

  // Auto-refresh opportunities every 30 seconds
  useEffect(() => {
    // Defer initial load so setState runs in a callback, not synchronously in the effect
    const load = () => {
      void fetchMarkets()
      void fetchOpportunities()
    }
    queueMicrotask(load)

    scanIntervalRef.current = setInterval(fetchOpportunities, 30_000)
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <Nav subtitle="Arbitrage Scanner — Prediction Markets" />
      {/* Action bar */}
      <div className="border-b border-zinc-800 px-6 py-2.5 flex items-center justify-between">
        <div />
        <div className="flex items-center gap-3">
          {statusMsg && <span className="text-xs text-zinc-400">{statusMsg}</span>}
          <button
            onClick={syncMarkets}
            disabled={syncing}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 disabled:opacity-50 transition-colors"
          >
            {syncing ? 'Syncing…' : 'Sync Markets'}
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-3 py-1.5 text-xs bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 rounded text-emerald-200 disabled:opacity-50 transition-colors font-bold"
          >
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-zinc-800 px-6 py-2 flex gap-8 text-xs text-zinc-500">
        <span>
          Markets: <span className="text-zinc-300 font-semibold">{markets.length}</span>
        </span>
        <span>
          Opportunities:{' '}
          <span className="text-emerald-400 font-semibold">{opportunities.length}</span>
        </span>
        {lastScan && (
          <span>
            Last scan:{' '}
            <span className="text-zinc-400">
              {lastScan.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </span>
        )}
        <span>
          Auto-refresh: <span className="text-zinc-400">30s</span>
        </span>
      </div>

      <main className="px-6 py-6 space-y-8">
        {/* Opportunities section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Arbitrage Opportunities
            {opportunities.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-emerald-900 text-emerald-300 rounded text-xs">
                {opportunities.length}
              </span>
            )}
          </h2>
          <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
            <OpportunityTable
              opportunities={opportunities}
              onStatusChange={(id, status) =>
                setOpportunities((prev) =>
                  prev.map((o) => (o.id === id ? { ...o, status } : o)),
                )
              }
            />
          </div>
        </section>

        {/* Markets section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            All Active Markets
          </h2>
          {loadingMarkets ? (
            <div className="flex items-center justify-center py-20 text-zinc-600">
              Loading markets…
            </div>
          ) : markets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-600">
              <p>No markets loaded.</p>
              <button
                onClick={syncMarkets}
                disabled={syncing}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync from Polymarket'}
              </button>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-4 font-medium">Question</th>
                    <th className="text-right py-3 px-3 font-medium w-20">YES</th>
                    <th className="text-right py-3 px-3 font-medium w-20">NO</th>
                    <th className="text-right py-3 px-3 font-medium w-24">Combined</th>
                    <th className="text-right py-3 px-3 font-medium w-28">Volume</th>
                    <th className="text-right py-3 px-4 font-medium w-36">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((m) => {
                    const combined =
                      m.yes_price != null && m.no_price != null
                        ? m.yes_price + m.no_price
                        : null
                    const isArb = combined != null && combined < 0.985
                    return (
                      <tr
                        key={m.condition_id}
                        className={`border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors ${isArb ? 'bg-emerald-950/20' : ''}`}
                      >
                        <td className="py-3 px-4 text-zinc-200 max-w-md">
                          <div className="truncate" title={m.question}>
                            {m.question}
                          </div>
                          {m.category && (
                            <div className="text-zinc-600 text-xs mt-0.5">{m.category}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <PriceBadge price={m.yes_price} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <PriceBadge price={m.no_price} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          {combined != null ? (
                            <span className={isArb ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                              {(combined * 100).toFixed(1)}¢
                              {isArb && (
                                <span className="ml-1 text-xs bg-emerald-900 text-emerald-300 px-1 rounded">
                                  ARB
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-zinc-400">
                          {formatVolume(m.volume)}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-500">
                          {formatEndDate(m.end_date)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
