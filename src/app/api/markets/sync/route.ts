import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getMarkets } from '@/lib/polymarket/client'
import { createClient } from '@/lib/supabase/server'

/** Deterministic UUID from condition_id for stable upserts */
function conditionIdToUuid(conditionId: string): string {
  const hash = createHash('sha256').update(conditionId).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

export async function POST() {
  try {
    const markets = await getMarkets()

    // 1. Log raw first market for debugging
    if (markets.length > 0) {
      console.log('Polymarket API raw first market:', JSON.stringify(markets[0], null, 2))
    }

    const supabase = createClient()

    // Deduplicate by condition_id — Polymarket can return same market multiple times
    const seen = new Set<string>()
    const uniqueMarkets = markets.filter((m) => {
      if (seen.has(m.condition_id)) return false
      seen.add(m.condition_id)
      return true
    })

    const rows = uniqueMarkets.map((m) => {
      // Polymarket returns "Yes"/"No" or "YES"/"NO" depending on market type
      const yes = m.tokens.find((t) => t.outcome === 'YES' || t.outcome === 'Yes')
      const no = m.tokens.find((t) => t.outcome === 'NO' || t.outcome === 'No')
      const volumeVal = (m as { volume?: string | number }).volume
      const volume = volumeVal != null ? parseFloat(String(volumeVal)) : null

      return {
        id: conditionIdToUuid(m.condition_id),
        condition_id: m.condition_id,
        question: m.question,
        slug: m.market_slug,
        yes_price: yes != null ? parseFloat(String(yes.price)) : null,
        no_price: no != null ? parseFloat(String(no.price)) : null,
        yes_token_id: yes?.token_id ?? null,
        no_token_id: no?.token_id ?? null,
        volume,
        end_date: m.end_date_iso ?? null,
        active: m.active ?? true,
        closed: m.closed ?? false,
      }
    })

    const { error } = await supabase
      .from('markets')
      .upsert(rows, { onConflict: 'condition_id' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ synced: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Markets sync error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
