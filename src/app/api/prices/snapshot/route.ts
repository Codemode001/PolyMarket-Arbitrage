import { NextResponse } from 'next/server'
import { getOrderBook } from '@/lib/polymarket/client'
import { createClient } from '@/lib/supabase/server'

const CONCURRENCY = 10

export async function POST() {
  try {
    const supabase = createClient()

    const { data: markets, error } = await supabase
      .from('markets')
      .select('id, condition_id, yes_token_id, no_token_id')
      .eq('active', true)
      .eq('closed', false)
      .not('yes_token_id', 'is', null)
      .not('no_token_id', 'is', null)
      .order('volume', { ascending: false })
      .limit(200)

    if (error || !markets) {
      return NextResponse.json({ error: error?.message ?? 'No markets' }, { status: 500 })
    }

    const snapshots: Array<{
      market_id: string
      token_id: string
      yes_price: number
      no_price: number
      combined_price: number
      created_at: string
    }> = []

    const now = new Date().toISOString()

    for (let i = 0; i < markets.length; i += CONCURRENCY) {
      const batch = markets.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (m: { id: string; yes_token_id: string; no_token_id: string }) => {
          try {
            const [yesBook, noBook] = await Promise.all([
              getOrderBook(m.yes_token_id),
              getOrderBook(m.no_token_id),
            ])

            const yesAsk = yesBook.asks[0]?.price
            const noAsk = noBook.asks[0]?.price

            if (!yesAsk || !noAsk) return

            const yesPrice = parseFloat(yesAsk)
            const noPrice = parseFloat(noAsk)

            if (isNaN(yesPrice) || isNaN(noPrice)) return

            snapshots.push({
              market_id: m.id,
              token_id: m.yes_token_id,
              yes_price: yesPrice,
              no_price: noPrice,
              combined_price: yesPrice + noPrice,
              created_at: now,
            })
          } catch {
            // Skip failed markets
          }
        }),
      )
    }

    if (snapshots.length > 0) {
      const { error: insertError } = await supabase.from('price_snapshots').insert(snapshots)
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ snapshotted: snapshots.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Snapshot failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
