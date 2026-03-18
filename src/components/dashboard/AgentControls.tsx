'use client'

import { useEffect, useState } from 'react'

interface AgentConfig {
  is_running: boolean
  mode: string
  daily_budget: number
  arb_max_per_trade: number
  arb_min_profit_pct: number
}

export function AgentControls({ onConfigChange }: { onConfigChange?: () => void }) {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [showFullAutoWarning, setShowFullAutoWarning] = useState(false)

  // Form fields
  const [dailyBudget, setDailyBudget] = useState('')
  const [maxPerTrade, setMaxPerTrade] = useState('')
  const [minProfitPct, setMinProfitPct] = useState('')

  async function fetchConfig() {
    const res = await fetch('/api/agent/config')
    if (res.ok) {
      const data: AgentConfig = await res.json()
      setConfig(data)
      setDailyBudget(String(data.daily_budget ?? 50))
      setMaxPerTrade(String(data.arb_max_per_trade ?? 10))
      setMinProfitPct(String(((data.arb_min_profit_pct ?? 0.015) * 100).toFixed(2)))
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  async function toggleAgent() {
    if (!config) return
    setLoading(true)
    setActionMsg(null)
    const endpoint = config.is_running ? '/api/agent/stop' : '/api/agent/start'
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (res.ok) {
        setActionMsg(config.is_running ? 'Agent stopped.' : 'Agent started.')
        await fetchConfig()
        onConfigChange?.()
      } else {
        const j = await res.json()
        setActionMsg(`Error: ${j.error}`)
      }
    } catch (e) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setLoading(false)
  }

  async function toggleMode() {
    if (!config) return
    const next = config.mode === 'full_auto' ? 'semi_auto' : 'full_auto'
    if (next === 'full_auto') {
      setShowFullAutoWarning(true)
      return
    }
    await applyMode(next)
  }

  async function applyMode(mode: string) {
    setShowFullAutoWarning(false)
    const res = await fetch('/api/agent/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (res.ok) {
      await fetchConfig()
      onConfigChange?.()
    }
  }

  async function saveSettings() {
    setLoading(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_budget: parseFloat(dailyBudget),
          arb_max_per_trade: parseFloat(maxPerTrade),
          arb_min_profit_pct: parseFloat(minProfitPct) / 100,
        }),
      })
      if (res.ok) {
        setActionMsg('Settings saved.')
        await fetchConfig()
        onConfigChange?.()
      } else {
        const j = await res.json()
        setActionMsg(`Error: ${j.error}`)
      }
    } catch (e) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setLoading(false)
  }

  const isRunning = config?.is_running ?? false
  const isFullAuto = config?.mode === 'full_auto'

  return (
    <div className="flex flex-col gap-5">
      {/* Start / Stop */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleAgent}
          disabled={loading || !config}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold tracking-wide disabled:opacity-50 transition-colors ${
            isRunning
              ? 'bg-red-900 hover:bg-red-800 border border-red-700 text-red-200'
              : 'bg-emerald-800 hover:bg-emerald-700 border border-emerald-600 text-emerald-100'
          }`}
        >
          {loading ? '…' : isRunning ? '⏹ Stop Agent' : '▶ Start Agent'}
        </button>

        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          disabled={!config}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider border transition-colors disabled:opacity-50 ${
            isFullAuto
              ? 'bg-orange-900/50 border-orange-700 text-orange-300 hover:bg-orange-900'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {isFullAuto ? 'FULL-AUTO' : 'SEMI-AUTO'}
        </button>
      </div>

      {/* Full-auto warning */}
      {showFullAutoWarning && (
        <div className="border border-orange-800 bg-orange-950/40 rounded-lg p-4 text-sm">
          <p className="text-orange-300 font-bold mb-2">⚠ Switch to Full-Auto?</p>
          <p className="text-orange-400/80 text-xs mb-3">
            Full-auto will place real bets automatically without confirmation. Only enable
            after validating fills in semi-auto mode.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => applyMode('full_auto')}
              className="px-3 py-1.5 bg-orange-800 hover:bg-orange-700 text-orange-100 text-xs rounded font-bold"
            >
              Yes, enable Full-Auto
            </button>
            <button
              onClick={() => setShowFullAutoWarning(false)}
              className="px-3 py-1.5 border border-zinc-700 text-zinc-400 text-xs rounded hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {actionMsg && (
        <p className="text-xs text-zinc-400">{actionMsg}</p>
      )}

      {/* Settings form */}
      <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Settings</p>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Daily Budget ($)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Max Per Trade ($)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={maxPerTrade}
              onChange={(e) => setMaxPerTrade(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Min Profit %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={minProfitPct}
              onChange={(e) => setMinProfitPct(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </label>
        </div>

        <button
          onClick={saveSettings}
          disabled={loading}
          className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded text-sm text-zinc-200 disabled:opacity-50 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
