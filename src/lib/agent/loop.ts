/**
 * Module-level singleton for the agent scan loop.
 * Survives across requests in a persistent Node.js process (dev/self-hosted).
 * This is intentional — Next.js serverless would not support this, but we run
 * the scanner as a long-lived process per CLAUDE.md architecture.
 */

import { runScanner } from '@/lib/scanner'
import { createClient } from '@/lib/supabase/server'

let agentInterval: ReturnType<typeof setInterval> | null = null

// Auto-resume on server boot if DB says is_running: true
// Runs once asynchronously so it doesn't block module load
async function maybeAutoResume() {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('agent_config')
      .select('is_running')
      .single()
    if (data?.is_running && !agentInterval) {
      startAgent()
    }
  } catch {
    // silently ignore on boot
  }
}
maybeAutoResume()

async function agentLog(
  level: 'info' | 'warning' | 'error',
  message: string,
  payload?: Record<string, unknown>,
) {
  try {
    const supabase = createClient()
    await supabase.from('agent_logs').insert({
      event: message,
      level,
      message,
      payload: payload ?? {},
      created_at: new Date().toISOString(),
    })
  } catch {
    // never throw from logging
  }
}

async function runCycle() {
  const supabase = createClient()

  // Check we're still supposed to be running
  const { data: config, error: configError } = await supabase
    .from('agent_config')
    .select('is_running, mode, arb_min_profit_pct')
    .single()

  if (configError) {
    console.error('[agent] agent_config read failed:', configError.message)
  }
  if (!config?.is_running) {
    if (agentInterval) {
      console.log('[agent] Stopping: is_running=false or no config row')
      stopAgent()
    }
    return
  }

  console.log('[agent] Scanner cycle starting...')
  try {
    const opportunities = await runScanner()

    if (config.mode === 'full_auto' && opportunities.length > 0) {
      // In full-auto, execute the best opportunity found
      // Fetch the freshly saved DB row to get its ID
      const { data: rows } = await supabase
        .from('arb_opportunities')
        .select('id')
        .eq('status', 'pending')
        .order('expected_profit_pct', { ascending: false })
        .limit(1)

      const bestId = rows?.[0]?.id
      if (bestId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const res = await fetch(`${appUrl}/api/arb/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: bestId }),
        })
        const result = await res.json()
        if (!res.ok) {
          await agentLog('warning', `Full-auto execute failed: ${result.error}`, { bestId })
        } else {
          await agentLog('info', `Full-auto executed: $${result.expectedProfit?.toFixed(4)} profit`, { bestId })
        }
      }
    }

    // Capture price snapshot
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${appUrl}/api/prices/snapshot`, { method: 'POST' }).catch(() => null)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cycle error'
    console.error('[agent] Cycle error:', message)
    await agentLog('error', `Cycle error: ${message}`, { error: message })
  }
}

export function startAgent() {
  if (agentInterval) clearInterval(agentInterval)
  agentInterval = setInterval(() => {
    runCycle().catch(() => null)
  }, 30_000)
  // Run immediately on start
  runCycle().catch(() => null)
}

export function stopAgent() {
  if (agentInterval) {
    clearInterval(agentInterval)
    agentInterval = null
  }
}

export function isAgentRunning() {
  return agentInterval !== null
}
