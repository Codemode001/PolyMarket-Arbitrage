import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString() // last 10 min

  const { data, error } = await supabase
    .from('arb_opportunities')
    .select('*, markets!arb_opportunities_market_id_a_fkey(question)')
    .gte('created_at', cutoff)
    .order('expected_profit_pct', { ascending: false })
    .limit(50)

  if (error) {
    console.error('arb/opportunities error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const opportunities = (data ?? []).map((d: {
    id: string
    market_id: string
    type: string
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
    type: d.type,
    question: (Array.isArray(d.markets) ? d.markets[0]?.question : null) ?? d.market_id,
    price_a: d.price_a,
    price_b: d.price_b,
    combined_price: d.combined_price,
    expected_profit_pct: d.expected_profit_pct,
    status: d.status,
    created_at: d.created_at,
  }))

  return NextResponse.json({ opportunities })
}
