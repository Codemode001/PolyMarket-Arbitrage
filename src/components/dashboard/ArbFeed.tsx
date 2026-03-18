'use client'

import { useEffect, useRef, useState } from 'react'

interface LogEntry {
  id: string
  level: string
  message: string
  payload: Record<string, unknown>
  created_at: string
}

interface OpportunityEntry {
  id: string
  question: string
  expected_profit_pct: number
  status: string
  created_at: string
}

type FeedItem =
  | { kind: 'log'; data: LogEntry }
  | { kind: 'opportunity'; data: OpportunityEntry }

function levelColor(level: string) {
  switch (level) {
    case 'error': return 'text-red-400'
    case 'warning': return 'text-yellow-400'
    default: return 'text-zinc-300'
  }
}

function levelTag(level: string) {
  switch (level) {
    case 'error':
      return <span className="text-red-500 font-bold uppercase text-xs mr-2">[ERR]</span>
    case 'warning':
      return <span className="text-yellow-500 font-bold uppercase text-xs mr-2">[WRN]</span>
    default:
      return <span className="text-zinc-600 text-xs mr-2">[INF]</span>
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function ArbFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  async function fetchLogs() {
    // Fetch directly from Supabase via the API
    const res = await fetch('/api/agent/logs').catch(() => null)
    if (res?.ok) {
      const json = await res.json()
      setLogs(json.logs ?? [])
    }
  }

  async function fetchOpportunities() {
    const res = await fetch('/api/arb/opportunities').catch(() => null)
    if (res?.ok) {
      const json = await res.json()
      setOpportunities(json.opportunities ?? [])
    }
  }

  useEffect(() => {
    fetchLogs()
    fetchOpportunities()

    const logInterval = setInterval(fetchLogs, 5_000)
    const oppInterval = setInterval(fetchOpportunities, 5_000)
    return () => {
      clearInterval(logInterval)
      clearInterval(oppInterval)
    }
  }, [])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Merge and sort logs + opportunity events into a unified feed
  const feed: FeedItem[] = [
    ...logs.map((l) => ({ kind: 'log' as const, data: l, ts: l.created_at })),
    ...opportunities.map((o) => ({ kind: 'opportunity' as const, data: o, ts: o.created_at })),
  ]
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .slice(-50)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Live Feed</span>
        <button
          onClick={() => setAutoScroll((v) => !v)}
          className={`text-xs px-2 py-0.5 rounded border ${autoScroll ? 'border-emerald-800 text-emerald-500' : 'border-zinc-700 text-zinc-500'}`}
        >
          {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto font-mono text-xs space-y-0.5 p-3"
        style={{ maxHeight: '400px' }}
      >
        {feed.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-zinc-700">
            No activity yet — start the agent to begin.
          </div>
        ) : (
          feed.map((item) => {
            if (item.kind === 'log') {
              const log = item.data
              return (
                <div key={`log-${log.id}`} className={`flex items-start gap-1 py-0.5 ${levelColor(log.level)}`}>
                  <span className="text-zinc-700 flex-shrink-0 tabular-nums">
                    {formatTime(log.created_at)}
                  </span>
                  {levelTag(log.level)}
                  <span className="flex-1">{log.message}</span>
                </div>
              )
            } else {
              const opp = item.data
              const profitStr = (opp.expected_profit_pct * 100).toFixed(2)
              return (
                <div key={`opp-${opp.id}`} className="flex items-start gap-1 py-0.5 text-emerald-400">
                  <span className="text-zinc-700 flex-shrink-0 tabular-nums">
                    {formatTime(opp.created_at)}
                  </span>
                  <span className="text-emerald-600 font-bold uppercase text-xs mr-2">[ARB]</span>
                  <span className="flex-1 truncate" title={opp.question}>
                    +{profitStr}% — {opp.question}
                  </span>
                </div>
              )
            }
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
