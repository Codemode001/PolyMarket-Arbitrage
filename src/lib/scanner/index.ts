import { scanYesNoArb, getScanningMarketCount, ArbOpportunity } from './yes-no'
import { createClient } from '@/lib/supabase/server'

export type { ArbOpportunity }

async function log(
  level: 'info' | 'warning' | 'error',
  message: string,
  payload?: Record<string, unknown>,
) {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('agent_logs').insert({
      event: message,
      level,
      message,
      payload: payload ?? {},
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[scanner] agent_logs insert failed:', error.message)
    }
  } catch (e) {
    console.error('[scanner] agent_logs insert error:', e)
  }
}

export async function runScanner(): Promise<ArbOpportunity[]> {
  const now = new Date()

  const marketCount = await getScanningMarketCount()
  await log('info', 'Scanner cycle started', { timestamp: now.toISOString(), marketCount })

  let opportunities: ArbOpportunity[] = []

  try {
    opportunities = await scanYesNoArb()

    // Deduplicate: drop markets already found within the last 60 seconds
    const cutoff = new Date(now.getTime() - 60_000).toISOString()
    const supabase = createClient()

    const { data: recent } = await supabase
      .from('arb_opportunities')
      .select('market_id, market_id_a')
      .gte('created_at', cutoff)
      .eq('type', 'yes_no')

    const recentIds = new Set(
      (recent ?? []).map((r: { market_id?: string; market_id_a?: string }) => r.market_id ?? r.market_id_a ?? ''),
    )
    const newOpportunities = opportunities.filter((o) => !recentIds.has(o.market_id) && !recentIds.has(o.market_uuid))

    if (newOpportunities.length > 0) {
      await supabase.from('arb_opportunities').insert(
        newOpportunities.map((o) => ({
          market_id_a: o.market_uuid,
          market_id: o.market_id,
          token_id_a: o.yes_token_id,
          token_id_b: o.no_token_id,
          type: o.type,
          price_a: o.price_a,
          price_b: o.price_b,
          combined_price: o.combined_price,
          expected_profit_pct: o.expected_profit_pct,
          status: 'pending',
          created_at: new Date().toISOString(),
        })),
      )
    }

    await log('info', `Scanner complete: ${marketCount} markets, ${opportunities.length} found, ${newOpportunities.length} new`, {
      marketCount,
      total: opportunities.length,
      new_count: newOpportunities.length,
    })

    return opportunities
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scanner error'
    await log('error', `Scanner error: ${message}`, { error: message })
    throw err
  }
}
