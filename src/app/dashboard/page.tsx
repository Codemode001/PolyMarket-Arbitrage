'use client'

import { useEffect, useState } from 'react'
import { AgentStatus } from '@/components/dashboard/AgentStatus'
import { AgentControls } from '@/components/dashboard/AgentControls'
import { BudgetMeter } from '@/components/dashboard/BudgetMeter'
import { ArbFeed } from '@/components/dashboard/ArbFeed'
import { Nav } from '@/components/shared/Nav'

interface AgentConfig {
  daily_budget: number
  daily_spent: number
}

export default function DashboardPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null)

  async function fetchConfig() {
    const res = await fetch('/api/agent/config').catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setConfig(data)
    }
  }

  useEffect(() => {
    fetchConfig()
    const interval = setInterval(fetchConfig, 5_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <Nav subtitle="Agent Control Panel" />

      <main className="px-6 py-6 space-y-6">
        {/* Top row: Status + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent Status */}
          <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-6">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-5">Agent Status</p>
            <AgentStatus />
          </div>

          {/* Agent Controls */}
          <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-6">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-5">Controls</p>
            <AgentControls onConfigChange={fetchConfig} />
          </div>
        </div>

        {/* Budget meter */}
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 p-6">
          <BudgetMeter
            spent={config?.daily_spent ?? 0}
            budget={config?.daily_budget ?? 0}
          />
        </div>

        {/* Live feed */}
        <div className="border border-zinc-800 rounded-xl bg-zinc-900/40 overflow-hidden">
          <ArbFeed />
        </div>
      </main>
    </div>
  )
}
