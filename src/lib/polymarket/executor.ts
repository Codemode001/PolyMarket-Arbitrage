import { ClobClient, Side, OrderType } from '@polymarket/clob-client'
import { createWalletClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const CLOB_HOST = 'https://clob.polymarket.com'
const FILL_POLL_INTERVAL_MS = 1_000
const FILL_POLL_MAX_ATTEMPTS = 15 // 15 seconds total wait

export interface PlacedOrder {
  orderId: string
  tokenId: string
  side: 'BUY' | 'SELL'
  price: number
  size: number
}

export interface FillResult {
  filled: boolean
  sizeMatched: number
  status: string
}

function buildClobClient(): ClobClient {
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY
  const apiKey = process.env.POLYMARKET_API_KEY

  if (!privateKey) throw new Error('POLYMARKET_PRIVATE_KEY is not set')
  if (!apiKey) throw new Error('POLYMARKET_API_KEY is not set')

  // privateKey must be 0x-prefixed hex
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  })

  // Parse POLYMARKET_API_KEY as JSON: { key, secret, passphrase }
  let creds: { key: string; secret: string; passphrase: string }
  try {
    creds = JSON.parse(apiKey)
  } catch {
    throw new Error('POLYMARKET_API_KEY must be JSON: { key, secret, passphrase }')
  }

  return new ClobClient(CLOB_HOST, 137, walletClient, creds)
}

/**
 * Places a BUY limit order on Polymarket.
 * price is the limit price (0–1), amount is in USDC.
 */
export async function placeBet(
  tokenId: string,
  side: 'BUY' | 'SELL',
  amount: number,
  price: number,
): Promise<PlacedOrder> {
  const client = buildClobClient()

  const size = parseFloat((amount / price).toFixed(4)) // shares = dollars / price

  const resp = await client.createAndPostOrder(
    {
      tokenID: tokenId,
      price,
      size,
      side: side === 'BUY' ? Side.BUY : Side.SELL,
    },
    undefined,
    OrderType.GTC,
  )

  if (!resp || resp.error) {
    throw new Error(`Order placement failed: ${JSON.stringify(resp)}`)
  }

  const orderId: string = resp.orderID ?? resp.id ?? resp.order_id
  if (!orderId) {
    throw new Error(`No order ID in response: ${JSON.stringify(resp)}`)
  }

  return { orderId, tokenId, side, price, size }
}

/**
 * Polls until the order is fully or partially filled, or times out.
 */
export async function confirmFill(orderId: string): Promise<FillResult> {
  const client = buildClobClient()

  for (let attempt = 0; attempt < FILL_POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, FILL_POLL_INTERVAL_MS))

    const order = await client.getOrder(orderId)

    if (!order) {
      throw new Error(`Order ${orderId} not found`)
    }

    const sizeMatched = parseFloat(order.size_matched ?? '0')

    // MATCHED or FILLED means it went through
    if (order.status === 'MATCHED' || order.status === 'FILLED') {
      return { filled: true, sizeMatched, status: order.status }
    }

    // CANCELED or REJECTED means it won't fill
    if (order.status === 'CANCELED' || order.status === 'REJECTED') {
      return { filled: false, sizeMatched, status: order.status }
    }

    // OPEN — keep polling
  }

  // Timed out — return partial info
  const order = await client.getOrder(orderId)
  const sizeMatched = parseFloat(order?.size_matched ?? '0')
  return {
    filled: sizeMatched > 0,
    sizeMatched,
    status: order?.status ?? 'TIMEOUT',
  }
}

/**
 * Cancels an open order. Used for rollback when leg 2 fails.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const client = buildClobClient()
  await client.cancelOrder({ orderID: orderId })
}
