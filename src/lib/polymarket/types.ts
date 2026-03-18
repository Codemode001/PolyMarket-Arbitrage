// Polymarket CLOB API types

export interface PolymarketToken {
  token_id: string
  outcome: string // 'YES' | 'NO'
  price: string
  winner: boolean
}

export interface Market {
  condition_id: string
  question_id: string
  tokens: PolymarketToken[]
  rewards: {
    rates: unknown[]
    min_size: number
    max_spread: number
  }
  minimum_order_size: string
  minimum_tick_size: string
  description: string
  category: string
  end_date_iso: string
  game_start_time: string | null
  question: string
  market_slug: string
  min_incentive_size: string
  max_incentive_spread: string
  active: boolean
  closed: boolean
  seconds_delay: number
  icon: string
  fpmm: string
  volume: string
  volume_24hr: string
}

export interface MarketsResponse {
  limit: number
  count: number
  next_cursor: string | null
  data: Market[]
}

export interface OrderBookLevel {
  price: string
  size: string
}

export interface OrderBook {
  market: string
  asset_id: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  hash: string
}
