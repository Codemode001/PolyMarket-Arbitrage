import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canPlaceBet, recordSpend } from '@/lib/risk/limits'
import { calculateSize } from '@/lib/risk/position'
import { placeBet, confirmFill, cancelOrder } from '@/lib/polymarket/executor'

async function log(
  level: 'info' | 'warning' | 'error',
  message: string,
  payload?: Record<string, unknown>,
) {
  const supabase = createClient()
  await supabase.from('agent_logs').insert({
    event: message,
    level,
    message,
    payload: payload ?? {},
    created_at: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  let opportunityId: string
  try {
    const body = await req.json()
    opportunityId = body.opportunity_id
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 1. Fetch opportunity
  const { data: opp, error: oppError } = await supabase
    .from('arb_opportunities')
    .select('*, markets!arb_opportunities_market_id_a_fkey(id, question, yes_token_id, no_token_id)')
    .eq('id', opportunityId)
    .single()

  if (oppError || !opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (opp.status !== 'pending') {
    return NextResponse.json(
      { error: `Opportunity is already ${opp.status}` },
      { status: 409 },
    )
  }

  // 2. Get agent config for sizing
  const { data: config } = await supabase
    .from('agent_config')
    .select('daily_budget, daily_spent, arb_max_per_trade')
    .single()

  const remainingBudget =
    Number(config?.daily_budget ?? 0) - Number(config?.daily_spent ?? 0)
  const maxPerTrade = Number(config?.arb_max_per_trade ?? 10)

  const betSize = calculateSize(opp.expected_profit_pct, remainingBudget, maxPerTrade)

  if (betSize <= 0) {
    return NextResponse.json({ error: 'Insufficient budget for this trade' }, { status: 422 })
  }

  // 3. Budget check
  const allowed = await canPlaceBet(betSize * 2) // both legs combined
  if (!allowed) {
    await log('warning', 'Execution blocked: budget limit', { opportunityId, betSize })
    return NextResponse.json({ error: 'Daily budget limit reached' }, { status: 422 })
  }

  // Mark as executing
  await supabase
    .from('arb_opportunities')
    .update({ status: 'executing' })
    .eq('id', opportunityId)

  const market = Array.isArray(opp.markets) ? opp.markets[0] : opp.markets
  const marketId = market?.id ?? opp.market_id_a ?? opp.market_id  // markets.id for FK
  const yesTokenId = market?.yes_token_id ?? opp.token_id_a ?? ''
  const noTokenId = market?.no_token_id ?? opp.token_id_b ?? ''
  const question = market?.question ?? opp.market_id ?? ''

  await log('info', `Executing arb: ${question}`, {
    opportunityId,
    betSize,
    priceA: opp.price_a,
    priceB: opp.price_b,
    expectedProfitPct: opp.expected_profit_pct,
  })

  let leg1OrderId: string | null = null

  try {
    // 4. Place leg 1 — YES (always first per CLAUDE.md)
    const leg1 = await placeBet(yesTokenId, 'BUY', betSize, opp.price_a)
    leg1OrderId = leg1.orderId

    await log('info', `Leg 1 placed: ${leg1OrderId}`, { orderId: leg1OrderId, price: opp.price_a })

    const fill1 = await confirmFill(leg1OrderId)

    if (!fill1.filled) {
      await cancelOrder(leg1OrderId).catch(() => null)
      await supabase
        .from('arb_opportunities')
        .update({ status: 'failed' })
        .eq('id', opportunityId)
      await log('warning', `Leg 1 did not fill: ${leg1OrderId}`, { status: fill1.status })
      return NextResponse.json({ error: 'Leg 1 did not fill', leg1Status: fill1.status }, { status: 422 })
    }

    await log('info', `Leg 1 filled: ${leg1OrderId}`, { sizeMatched: fill1.sizeMatched })

    // Insert leg 1 bet record
    const { data: bet1 } = await supabase
      .from('bets')
      .insert({
        market_id: marketId,
        token_id: yesTokenId,
        side: 'YES',
        direction: 'BUY',
        amount: betSize,
        entry_price: opp.price_a,
        order_id: leg1OrderId,
        price: opp.price_a,
        size: leg1.size,
        amount_usdc: betSize,
        status: 'filled',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    // 5. Place leg 2 — NO
    let leg2OrderId: string | null = null
    let leg2Filled = false

    try {
      const leg2 = await placeBet(noTokenId, 'BUY', betSize, opp.price_b)
      leg2OrderId = leg2.orderId

      await log('info', `Leg 2 placed: ${leg2OrderId}`, { orderId: leg2OrderId, price: opp.price_b })

      const fill2 = await confirmFill(leg2OrderId)
      leg2Filled = fill2.filled

      if (!fill2.filled) {
        // CRITICAL: leg 2 failed — sell leg 1 immediately at market to avoid exposure
        await log('error', 'Leg 2 failed — rolling back leg 1', {
          leg1OrderId,
          leg2OrderId,
          leg2Status: fill2.status,
        })

        // Cancel leg 2 if still open
        await cancelOrder(leg2OrderId).catch(() => null)

        // Sell leg 1 back at market
        await placeBet(yesTokenId, 'SELL', betSize, opp.price_a).catch(async (e) => {
          await log('error', `CRITICAL: Could not sell leg 1 after leg 2 failure: ${e.message}`, {
            leg1OrderId,
          })
        })

        await supabase
          .from('bets')
          .update({ status: 'partial_rollback' })
          .eq('order_id', leg1OrderId)

        await supabase
          .from('arb_opportunities')
          .update({ status: 'failed' })
          .eq('id', opportunityId)

        return NextResponse.json(
          { error: 'Leg 2 did not fill — leg 1 rolled back', leg2Status: fill2.status },
          { status: 422 },
        )
      }

      await log('info', `Leg 2 filled: ${leg2OrderId}`, { sizeMatched: fill2.sizeMatched })
    } catch (leg2Err) {
      const msg = leg2Err instanceof Error ? leg2Err.message : 'Leg 2 error'
      await log('error', `Leg 2 exception — rolling back leg 1: ${msg}`, { leg1OrderId })

      // Sell leg 1 back at market
      await placeBet(yesTokenId, 'SELL', betSize, opp.price_a).catch(() => null)

      await supabase
        .from('arb_opportunities')
        .update({ status: 'failed' })
        .eq('id', opportunityId)

      return NextResponse.json({ error: `Leg 2 failed: ${msg}` }, { status: 500 })
    }

    // Insert leg 2 bet record
    const { data: bet2 } = await supabase
      .from('bets')
      .insert({
        market_id: marketId,
        token_id: noTokenId,
        side: 'NO',
        direction: 'BUY',
        amount: betSize,
        entry_price: opp.price_b,
        order_id: leg2OrderId,
        price: opp.price_b,
        size: betSize / opp.price_b,
        amount_usdc: betSize,
        status: leg2Filled ? 'filled' : 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    // 6. Record the arb execution
    const expectedProfit = betSize * 2 * opp.expected_profit_pct

    await supabase.from('arb_executions').insert({
      opportunity_id: opportunityId,
      market_id: marketId,
      bet_id_a: bet1?.id ?? null,
      bet_id_b: bet2?.id ?? null,
      size_usdc: betSize * 2,
      expected_profit_usdc: expectedProfit,
      status: 'open',
      created_at: new Date().toISOString(),
    })

    // 7. Mark opportunity executed and record spend
    await supabase
      .from('arb_opportunities')
      .update({ status: 'executed' })
      .eq('id', opportunityId)

    await recordSpend(betSize * 2)

    await log('info', `Arb executed successfully: $${expectedProfit.toFixed(4)} expected profit`, {
      opportunityId,
      betSize: betSize * 2,
      expectedProfit,
    })

    return NextResponse.json({
      success: true,
      opportunityId,
      betSize,
      expectedProfit,
      leg1OrderId,
      leg2OrderId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution error'
    await log('error', `Execution failed: ${message}`, { opportunityId, leg1OrderId })

    await supabase
      .from('arb_opportunities')
      .update({ status: 'failed' })
      .eq('id', opportunityId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
