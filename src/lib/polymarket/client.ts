import { Market, MarketsResponse, OrderBook } from './types'

const CLOB_BASE = 'https://clob.polymarket.com'

export async function getMarkets(limit = 100): Promise<Market[]> {
  const markets: Market[] = []
  let nextCursor: string | null = null

  do {
    const url = new URL(`${CLOB_BASE}/markets`)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('active', 'true')
    if (nextCursor) {
      url.searchParams.set('next_cursor', nextCursor)
    }

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Polymarket /markets error: ${res.status} ${res.statusText}`)
    }

    const json: MarketsResponse = await res.json()
    markets.push(...json.data)
    nextCursor = json.next_cursor ?? null

    // Cap at 500 markets to avoid very long syncs
    if (markets.length >= 500) break
  } while (nextCursor)

  return markets
}

export async function getOrderBook(tokenId: string): Promise<OrderBook> {
  const url = `${CLOB_BASE}/book?token_id=${encodeURIComponent(tokenId)}`

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Polymarket /book error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
