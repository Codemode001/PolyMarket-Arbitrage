import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bets')
    .select(`
      id,
      market_id,
      side,
      amount_usdc,
      price,
      size,
      status,
      pnl,
      created_at,
      markets ( question )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const bets = (data ?? []).map((b: {
    id: string
    market_id: string
    side: string
    amount_usdc: number
    price: number
    size: number
    status: string
    pnl: number | null
    created_at: string
    markets: { question: string }[] | null
  }) => ({
    id: b.id,
    market_id: b.market_id,
    question: (Array.isArray(b.markets) ? b.markets[0]?.question : null) ?? b.market_id,
    side: b.side,
    amount_usdc: b.amount_usdc,
    price: b.price,
    size: b.size,
    status: b.status,
    pnl: b.pnl ?? null,
    created_at: b.created_at,
  }))

  return NextResponse.json({ bets })
}
