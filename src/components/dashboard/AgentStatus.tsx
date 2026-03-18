'use client'

import { useEffect, useState } from 'react'

interface AgentConfig {
  is_running: boolean
  mode: string
  daily_budget: number
  daily_spent: number
  arb_min_profit_pct: number
}

export function AgentStatus() {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [error, setError] = useState(false)

  async function fetchConfig() {
    try {
      const res = await fetch('/api/agent/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    fetchConfig()
    const interval = setInterval(fetchConfig, 5_000)
    return () => clearInterval(interval)
  }, [])

  const isRunning = config?.is_running ?? false
  const mode = config?.mode ?? 'semi_auto'
  const spent = config?.daily_spent ?? 0
  const budget = config?.daily_budget ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Running badge */}
      <div className="flex items-center gap-3">
        <div
          className={`relative flex h-4 w-4 items-center justify-center ${isRunning ? '' : ''}`}
        >
          {isRunning && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-red-600'}`}
          />
        </div>
        <span
          className={`text-3xl font-black tracking-widest ${isRunning ? 'text-emerald-400' : 'text-red-500'}`}
        >
          {error ? 'ERROR' : isRunning ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Mode</span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
            mode === 'full_auto'
              ? 'bg-orange-900/60 text-orange-300 border border-orange-800'
              : 'bg-emerald-900/40 text-emerald-400 border border-emerald-900'
          }`}
        >
          {mode === 'full_auto' ? 'FULL-AUTO' : 'SEMI-AUTO'}
        </span>
      </div>

      {/* Budget text */}
      <div className="text-xs text-zinc-500">
        <span className="text-zinc-300 font-mono">${spent.toFixed(2)}</span>
        <span className="mx-1">/</span>
        <span className="font-mono">${budget.toFixed(2)}</span>
        <span className="ml-1">spent today</span>
      </div>
    </div>
  )
}
