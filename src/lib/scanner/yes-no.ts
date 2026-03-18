import { getOrderBook } from '@/lib/polymarket/client'
import { createClient } from '@/lib/supabase/server'

export const MIN_PROFIT_THRESHOLD = 0.015 // 1.5% minimum
const CONCURRENCY = 10

export interface ArbOpportunity {
  market_id: string       // condition_id (for display)
  market_uuid: string     // markets.id (for FK joins)
  question: string
  type: 'yes_no'
  yes_token_id: string
  no_token_id: string
  price_a: number  // YES best ask
  price_b: number  // NO best ask
  combined_price: number
  expected_profit_pct: number
}

interface MarketRecord {
  id: string
  condition_id: string
  question: string
  yes_token_id: string
  no_token_id: string
}

async function checkMarket(market: MarketRecord): Promise<ArbOpportunity | null> {
  try {
    const [yesBook, noBook] = await Promise.all([
      getOrderBook(market.yes_token_id),
      getOrderBook(market.no_token_id),
    ])

    // asks are sorted ascending — index 0 is the best (lowest) ask
    const bestYesAsk = yesBook.asks[0]?.price
    const bestNoAsk = noBook.asks[0]?.price

    if (!bestYesAsk || !bestNoAsk) return null

    const yesPrice = parseFloat(bestYesAsk)
    const noPrice = parseFloat(bestNoAsk)

    if (isNaN(yesPrice) || isNaN(noPrice)) return null

    const combined = yesPrice + noPrice
    const profitPct = 1 - combined

    if (profitPct > MIN_PROFIT_THRESHOLD) {
      return {
        market_id: market.condition_id,
        market_uuid: market.id,
        question: market.question,
        type: 'yes_no',
        yes_token_id: market.yes_token_id,
        no_token_id: market.no_token_id,
        price_a: yesPrice,
        price_b: noPrice,
        combined_price: combined,
        expected_profit_pct: profitPct,
      }
    }
    return null
  } catch {
    return null
  }
}

export async function getScanningMarketCount(): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('markets')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .eq('closed', false)
    .not('yes_token_id', 'is', null)
    .not('no_token_id', 'is', null)
  return error ? 0 : (count ?? 0)
}

export async function scanYesNoArb(): Promise<ArbOpportunity[]> {
  const supabase = createClient()

  const { data: markets, error } = await supabase
    .from('markets')
    .select('id, condition_id, question, yes_token_id, no_token_id')
    .eq('active', true)
    .eq('closed', false)
    .not('yes_token_id', 'is', null)
    .not('no_token_id', 'is', null)
    .order('volume', { ascending: false })
    .limit(200)

  if (error || !markets) {
    throw new Error(`Failed to fetch markets: ${error?.message}`)
  }

  const opportunities: ArbOpportunity[] = []

  // Process in batches to avoid rate limiting
  for (let i = 0; i < markets.length; i += CONCURRENCY) {
    const batch = markets.slice(i, i + CONCURRENCY) as MarketRecord[]
    const results = await Promise.all(batch.map(checkMarket))
    for (const r of results) {
      if (r) opportunities.push(r)
    }
  }

  return opportunities.sort((a, b) => b.expected_profit_pct - a.expected_profit_pct)
}
