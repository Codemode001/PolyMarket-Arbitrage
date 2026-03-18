# Polymarket Arbitrage Agent — CLAUDE.md

## Project Overview
An autonomous arbitrage bot that scans Polymarket prediction markets every 30
seconds, detects mathematical mispricings, and executes both legs of an arb
trade instantly. Profit comes from speed and math — not prediction.

Core insight: On Polymarket, YES + NO for the same market must equal $1.00 at
resolution. If you can buy both for less than $1.00 combined, you lock in
guaranteed profit regardless of outcome.

## Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Anthropic Claude API (only used for dashboard summaries, NOT for trading)
- Polymarket CLOB API (market data + order execution)
- Supabase (PostgreSQL)
- setInterval for scanning (NOT cron — too slow for arb)

## The Three Arbitrage Types

### Type 1 — Yes/No Arb (build first)
YES price + NO price should always equal $1.00
If YES = $0.48 and NO = $0.49, combined = $0.97
Buy both for $0.97, collect $1.00 at resolution = 3% guaranteed profit
Scanner looks for any market where combined price < $0.985

### Type 2 — Logical Arb (build second)
Correlated markets must be logically consistent
"Trump wins 2028" at 35% means "Republican wins 2028" cannot be below 35%
If it is — the lower one is mispriced, buy it instantly
Requires a hardcoded map of logically related market pairs

### Type 3 — Cross-market Price Lag (build last)
Same event priced differently across correlated markets
Closes in seconds — needs fastest possible execution
Do not build until Types 1 and 2 are profitable and validated

## Core Agent Loop
Runs every 30 seconds via setInterval in a persistent API route:
1. Fetch current order books for all active tracked markets
2. Calculate YES + NO combined price for every market
3. Flag markets where combined < (1 - arb_min_profit_pct)
4. Check logical arb pairs from the correlation map
5. Store found opportunities in arb_opportunities table
6. If full-auto AND profit > threshold: execute both legs immediately
7. If semi-auto: push to dashboard, wait for user confirmation
8. Snapshot prices to price_snapshots regardless of opportunity found
9. Log all activity to agent_logs

## Bet Execution Rules (Critical)
- Both legs must be placed as fast as possible — sequential, not parallel
- Place the larger leg first (always YES when buying both sides)
- If leg 2 fails for any reason: immediately sell leg 1 at market price
- Never hold one leg of an arb open — that is directional speculation
- Use limit orders at current best ask price from the order book
- Confirm fill before marking execution as complete

## Position Sizing
Arb is theoretically risk-free if both legs fill — no Kelly Criterion needed.
size = min(arb_max_per_trade, remaining_daily_budget)
Start small ($5-10 per trade) to validate fills are actually happening.
Scale up only after confirming real fills in production.

## File Structure
src/
  app/
    page.tsx                        # Live arb opportunity feed
    dashboard/page.tsx              # Agent control panel
    market/[id]/page.tsx            # Market detail + price history chart
    tracker/page.tsx                # Execution history + realized P&L
    analytics/page.tsx              # Profit charts, fill rate, arb breakdown
    api/
      agent/
        run/route.ts                # POST — trigger one scan cycle manually
        config/route.ts             # GET/PUT — read and update agent_config
        start/route.ts              # POST — start continuous scanning loop
        stop/route.ts               # POST — stop the loop
      scanner/route.ts              # POST — run full scan, return opportunities
      arb/
        execute/route.ts            # POST — execute a specific opportunity
        opportunities/route.ts      # GET — list recent opportunities
      markets/
        sync/route.ts               # POST — sync market list from Polymarket
        [id]/route.ts               # GET — single market detail
      prices/
        snapshot/route.ts           # POST — capture current price snapshot
  lib/
    polymarket/
      client.ts                     # Market fetching + order book reads
      executor.ts                   # Order placement, fill confirmation
      types.ts                      # All Polymarket API TypeScript types
    scanner/
      yes-no.ts                     # Type 1 arb: scans YES+NO combined price
      logical.ts                    # Type 2 arb: correlated market pairs
      index.ts                      # Orchestrates both scanners, deduplicates
    risk/
      limits.ts                     # Daily budget enforcement
      position.ts                   # Trade sizing logic
    supabase/
      client.ts                     # Browser Supabase client
      server.ts                     # Server Supabase client (service role)
      types.ts                      # Generated DB types

  components/
    dashboard/
      AgentStatus.tsx               # Big ON/OFF indicator, mode badge
      AgentControls.tsx             # Start/stop, mode toggle, budget input
      ArbFeed.tsx                   # Real-time scrolling opportunity log
      BudgetMeter.tsx               # Daily spent / total progress bar
    opportunities/
      OpportunityTable.tsx          # Sortable table of found arb opportunities
      OpportunityCard.tsx           # Single opportunity with profit %, action
      ExecuteDialog.tsx             # Confirm modal for semi-auto execution
    markets/
      MarketTable.tsx               # Full market list with live prices
      PriceHistory.tsx              # Sparkline of YES+NO combined over time
    analytics/
      ProfitChart.tsx               # Cumulative P&L line chart (recharts)
      ArbTypeBreakdown.tsx          # Pie: Type 1 vs Type 2 profit split
      FillRateChart.tsx             # % of opportunities that actually filled
    shared/
      ProfitBadge.tsx               # Color-coded profit % pill
      StatusBadge.tsx               # Opportunity/execution status pill

## Database Schema Reference
Tables already created in Supabase:
  markets              — cached market list from Polymarket
  research             — unused for now, ignore
  bets                 — individual bet legs
  agent_config         — settings (extended with arb columns)
  agent_logs           — all agent activity
  arb_opportunities    — found arb chances with profit %
  arb_executions       — paired bets that form a complete arb trade
  price_snapshots      — historical YES+NO price captures

## Key Implementation: Yes/No Scanner
This is the most important file in the project (src/lib/scanner/yes-no.ts):

async function scanYesNoArb(markets: Market[]): Promise<ArbOpportunity[]> {
  const opportunities = []

  for (const market of markets) {
    const book = await getOrderBook(market.conditionId)
    const bestYesAsk = book.asks.find(a => a.side === 'YES')?.price
    const bestNoAsk = book.asks.find(a => a.side === 'NO')?.price

    if (!bestYesAsk || !bestNoAsk) continue

    const combined = Number(bestYesAsk) + Number(bestNoAsk)
    const profitPct = 1 - combined

    if (profitPct > MIN_PROFIT_THRESHOLD) {
      opportunities.push({
        type: 'yes_no',
        marketId: market.id,
        priceA: bestYesAsk,
        priceB: bestNoAsk,
        combinedPrice: combined,
        expectedProfitPct: profitPct
      })
    }
  }

  return opportunities.sort((a, b) => b.expectedProfitPct - a.expectedProfitPct)
}

## Key Implementation: Logical Arb Map
Hardcode known correlated market pairs in src/lib/scanner/logical.ts:

const LOGICAL_PAIRS = [
  {
    parent: 'will-republican-win-2028-election',
    child: 'will-trump-win-2028-election',
    relationship: 'subset', // child probability can never exceed parent
  },
  // add more pairs as you discover them
]

async function scanLogicalArb(markets: Market[]): Promise<ArbOpportunity[]> {
  const opportunities = []

  for (const pair of LOGICAL_PAIRS) {
    const parentMarket = markets.find(m => m.slug === pair.parent)
    const childMarket = markets.find(m => m.slug === pair.child)
    if (!parentMarket || !childMarket) continue

    if (pair.relationship === 'subset') {
      // child YES price cannot exceed parent YES price
      if (childMarket.yesPrice > parentMarket.yesPrice) {
        opportunities.push({
          type: 'logical',
          marketIdA: parentMarket.id,
          marketIdB: childMarket.id,
          priceA: parentMarket.yesPrice,
          priceB: childMarket.yesPrice,
          expectedProfitPct: childMarket.yesPrice - parentMarket.yesPrice,
          action: 'BUY_PARENT_SELL_CHILD'
        })
      }
    }
  }

  return opportunities
}

## Polymarket API Reference
Base URL: https://clob.polymarket.com

GET  /markets                    — paginated market list
GET  /markets/{condition_id}     — single market
GET  /book?token_id={token_id}  — order book for a token
POST /order                      — place an order (requires auth)

Auth for order placement uses L1 ECDSA signatures.
Private key lives in POLYMARKET_PRIVATE_KEY env var only — never in DB.
Use the official @polymarket/clob-client npm package for auth handling.

## Environment Variables Required
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POLYMARKET_API_KEY
POLYMARKET_PRIVATE_KEY
NEXT_PUBLIC_APP_URL

## Dashboard UI Requirements
- Dark theme throughout — trading terminal aesthetic
- Agent status: large prominent ON/OFF badge at top of every page
- Mode toggle: SEMI-AUTO (green) / FULL-AUTO (orange, with warning)
- ArbFeed: live scrolling log, polls /api/arb/opportunities every 5 seconds
- Opportunity table columns: Market, Type, YES%, NO%, Combined, Profit%, Age, Action
- Profit% column: green if > 2%, yellow if 1-2%, red if < 1%
- ExecuteDialog: shows market name, both prices, expected profit in $, confirm button
- BudgetMeter: progress bar — daily spent / daily limit
- Analytics page must have: cumulative P&L chart, fill rate %, avg profit per trade

## Error Handling Rules
- All errors caught and written to agent_logs with level='error' and full payload
- If Polymarket API fails: log, skip this scan cycle, retry next interval
- If leg 1 fills but leg 2 fails: immediately market-sell leg 1, log as 'partial'
- If daily budget hit: stop agent immediately, log warning, do not resume until reset
- Never throw unhandled exceptions from the scanner loop — it must keep running

## Build Phases
Phase 1 (do first): Supabase client, Polymarket client, markets sync, market table UI
Phase 2: Yes/No scanner, price snapshots, opportunity table UI
Phase 3: Bet execution (both legs), arb_executions tracking, semi-auto confirm flow
Phase 4: Full-auto mode, budget enforcement, agent start/stop controls
Phase 5: Analytics page, P&L charts, fill rate tracking, logical arb scanner

## What NOT to Do
- Do not use Claude API for trading decisions — arb is pure math, no AI needed
- Do not build Type 3 cross-market arb until Types 1 and 2 are live and profitable
- Do not place bets larger than arb_max_per_trade regardless of opportunity size
- Do not run both legs in parallel — sequential only, leg 1 then leg 2
- Do not store private keys anywhere except environment variables
- Do not expose SUPABASE_SERVICE_ROLE_KEY to any client component
- Do not skip fill confirmation — always verify the order actually filled

## Portfolio Notes
The most impressive parts to highlight:
1. Real-time scanner with setInterval — shows understanding of latency constraints
2. Two-leg atomic execution with rollback — shows production-grade thinking
3. Live dashboard with opportunity feed — shows full-stack capability
4. Mathematical arbitrage logic — shows you understand the financial mechanism
Make the reasoning visible in the UI. Show the combined price calculation,
the profit %, and the execution log for every trade. That is what impresses
technical interviewers — not just that it works, but that you understand why.
```

That's the complete file. Paste it into Claude Code right after with:
```
Read CLAUDE.md fully. Start with Phase 1: Supabase clients, 
Polymarket client with getMarkets() and getOrderBook(), markets 
sync API route, and a dark-themed market table on the home page. 
Nothing else yet. Tell me when done.