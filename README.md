# Polymarket Arbitrage Agent

An autonomous scanner that finds yes/no arbitrage opportunities on Polymarket prediction markets and optionally executes them. Built as a portfolio project to demonstrate full-stack development, market microstructure understanding, and production-grade error handling.

---

## How It Works

### The Arbitrage Math

On Polymarket, every binary market has two tokens: **YES** and **NO**. At resolution, exactly one pays out $1.00 and the other pays $0.00. So:

**YES + NO must always equal $1.00** at settlement — it's a mathematical certainty.

During trading, the order book can briefly misprice. If you can buy **both** YES and NO for less than $1.00 combined, you lock in guaranteed profit regardless of the outcome.

**Example with real numbers:**
- YES best ask = $0.48  
- NO best ask = $0.49  
- Combined cost = $0.97  
- Payoff at resolution = $1.00 (either YES or NO wins)  
- **Profit = $0.03 per $1.00 staked ≈ 3% guaranteed**

The scanner looks for markets where `combined_price < (1 - min_profit_threshold)`, defaulting to 1.5%. When it finds one, it stores the opportunity and — in semi-auto mode — lets you confirm execution, or in full-auto mode, executes both legs immediately.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** (App Router) | Full-stack app: API routes for scanner/execution, server components, and real-time dashboard |
| **TypeScript** | Type safety for market data, order placement, and DB models |
| **Supabase** (PostgreSQL) | Markets cache, agent config, arb opportunities, executions, price snapshots, and logs |
| **Tailwind CSS + shadcn/ui** | Fast UI development, dark terminal aesthetic |
| **@polymarket/clob-client** | Official Polymarket CLOB API client — auth, order placement, fill confirmation |
| **viem** | Wallet/signing for order authentication (Polymarket uses L1 ECDSA) |
| **setInterval** (in-process) | Scanner loop runs every 30 seconds; not cron — too slow for arb. Must run as a long-lived Node process. |

---

## Architecture Overview

### Scanner Loop

The agent runs in the same Node.js process as the Next.js app (dev or self-hosted). On start:

1. `POST /api/agent/start` sets `is_running: true` in `agent_config` and starts a `setInterval(30_000)`.
2. Each cycle: fetch active markets from DB → call `runScanner()` → scan order books for YES+NO combined &lt; threshold.
3. New opportunities are written to `arb_opportunities` (status `pending`).
4. Price snapshots are captured regardless.
5. In full-auto mode, the best opportunity is executed via internal `fetch` to `/api/arb/execute`.
6. All activity is logged to `agent_logs`.

On server boot, `maybeAutoResume()` checks if `is_running` is true and restarts the loop if so.

### Two-Leg Execution with Rollback

Execution is strictly sequential (never parallel):

1. **Leg 1 (YES)** — Place limit order at best ask. Poll for fill. If no fill, cancel and abort.
2. **Leg 2 (NO)** — Place limit order. Poll for fill.
3. **If leg 2 fails:** Immediately sell leg 1 back at market to avoid directional exposure. Mark opportunity as `failed`, log as partial rollback.
4. If both fill, record `arb_executions`, update `arb_opportunities` to `executed`, and record spend.

This ensures you never hold one leg of an arb open — that would be directional speculation, not arbitrage.

### Semi-Auto vs Full-Auto

- **Semi-auto (default):** Opportunities appear in the dashboard. You review and click "Execute" to run both legs. Safe for testing.
- **Full-auto:** Scanner executes the best opportunity per cycle automatically. Use with small budgets and full understanding of execution risk.

### Real-Time Dashboard

- Polls `/api/agent/config` every 5 seconds for status and budget.
- Polls `/api/arb/opportunities` for the live opportunity feed.
- Dark theme, trading-terminal feel.

---

## Features

- **Yes/No arb scanner** — Scans top 200 markets by volume, flags combined price &lt; threshold
- **Order book reads** — Best ask for YES and NO tokens per market
- **Sequential two-leg execution** — YES first, then NO; rollback leg 1 if leg 2 fails
- **Semi-auto and full-auto modes** — Toggle in agent config
- **Daily budget and per-trade limits** — Enforced before placement
- **Price snapshots** — Historical YES+NO combined prices
- **Arb feed** — Live list of found opportunities
- **Execution tracker** — History of arb executions and P&L
- **Analytics page** — Cumulative P&L, fill rate, arb breakdown (when wired to data)
- **Agent logs** — All activity logged with level and payload
- **Markets sync** — Pull market list from Polymarket and cache in Supabase

---

## Screenshots

<img width="1360" height="566" alt="Screenshot 2026-03-18 at 9 29 28 PM" src="https://github.com/user-attachments/assets/824e7ec4-aba8-41c9-93e5-b2b03c8616c3" />
<img width="1428" height="664" alt="Screenshot 2026-03-18 at 9 30 29 PM" src="https://github.com/user-attachments/assets/5c5b2d97-84f9-4137-a0bc-a1fbdc10589d" />
<img width="1435" height="665" alt="Screenshot 2026-03-18 at 9 30 39 PM" src="https://github.com/user-attachments/assets/a544099f-762a-4a92-b933-f8d5dd3e5ff0" />
<img width="1421" height="662" alt="Screenshot 2026-03-18 at 9 30 53 PM" src="https://github.com/user-attachments/assets/867cd955-9de3-435e-ad29-fb396b35c23c" />



---

## Setup and Installation

### Prerequisites

- Node.js 18+
- A Supabase project
- Polymarket API credentials (CLOB API key + private key for signing)

### Install

```bash
git clone <repo-url>
cd polymarket-agent
npm install
```

### Environment Variables

Create `.env.local` in the project root:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — **never expose to client**. Used for server-side DB writes. |
| `POLYMARKET_API_KEY` | Yes | JSON object: `{"key":"...","secret":"...","passphrase":"..."}` from Polymarket CLOB API |
| `POLYMARKET_PRIVATE_KEY` | Yes | Wallet private key (0x-prefixed hex) for signing orders. **Never commit or store in DB.** |
| `NEXT_PUBLIC_APP_URL` | For agent/arb | Base URL of the app (e.g. `http://localhost:3000`). Used by the in-process agent to call `/api/arb/execute` and `/api/prices/snapshot`. |
| `ANTHROPIC_API_KEY` | Optional | Only used for dashboard summaries if implemented — not used for trading logic |

### Database Setup

Run the Supabase migrations in order:

```bash
supabase db push
# Or run migrations manually in the Supabase SQL editor
```

Migrations live in `supabase/migrations/`:
- `20250318000000_create_markets_table.sql`
- `20250318100000_create_agent_logs.sql`
- `20250318100001_create_arb_opportunities.sql`
- `20250318110000_align_schema_with_code.sql`

---

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `markets` | Cached market list from Polymarket — question, condition_id, yes/no token IDs, prices, volume |
| `agent_config` | Singleton row: `is_running`, `mode`, `daily_budget`, `daily_spent`, `arb_max_per_trade`, `arb_min_profit_pct`, etc. |
| `agent_logs` | Event log — level, message, payload, timestamp |
| `arb_opportunities` | Found arb chances — type, market IDs, prices, combined, expected profit %, status |
| `arb_executions` | Completed arb trades — links to bets, size, expected profit, status |
| `bets` | Individual bet legs — market, token, side, amount, entry price, order_id, status |
| `price_snapshots` | Historical YES/NO/combined price captures |
| `research` | Unused for now |

---

## How to Run Locally

1. **Start the dev server:**

   ```bash
   npm run dev
   ```

2. **Sync markets:**  
   Visit the home page and click "Sync Markets" (or `POST /api/markets/sync`). This fetches from Polymarket and populates `markets`.

3. **Start the agent:**  
   Go to `/dashboard`, set budget and mode, and click "Start Agent". The scanner runs every 30 seconds in-process.

4. **Monitor opportunities:**  
   Opportunities appear on the home page and in the dashboard ArbFeed. In semi-auto mode, click "Execute" to run both legs.

5. **Stop the agent:**  
   Click "Stop Agent" on the dashboard, or set `is_running: false` in `agent_config`.

---

## Limitations

This section is intentionally candid. Understanding constraints is part of being a good engineer.

### 30-Second Scan vs. Millisecond Arb Windows

The scanner runs every **30 seconds** via `setInterval`. Real arbitrage on prediction markets often exists for milliseconds. Professional arb shops use co-located servers, direct exchange connectivity, and sub-millisecond order placement. By the time this bot finds an opportunity and tries to execute, it may already be gone. The 30-second interval is a deliberate choice for a portfolio project — fast enough to illustrate the flow, slow enough to avoid hammering APIs or burning budget on stale prices.

### Better as a Research Tool Than a Pure Arb Bot

The honest assessment: this project works best as a **research and learning tool**, not as a competitive arb system. You can:

- Study where and when yes/no mispricings appear
- Observe fill rates and slippage
- Validate the two-leg execution and rollback logic
- Practice building a trading-adjacent full-stack app

To make it truly competitive you would need:

1. **Latency** — Sub-second scans, possibly WebSocket order books instead of REST
2. **Infrastructure** — Dedicated process (or separate service) for the scanner, not tied to Next.js request lifecycle
3. **Smarter execution** — Taker orders when urgency matters, better fill detection, potential for market-making
4. **Scale** — More markets, logical arb (Type 2), cross-market arb (Type 3) with proper correlation maps
5. **Risk** — More robust handling of partial fills, network failures, and exchange outages

### Other Caveats

- Runs in-process with Next.js — not ideal for serverless (Vercel, etc.). Use a long-lived Node process or separate worker.
- Polymarket rate limits apply; scanning 200 markets with order book fetches can hit limits under heavy load.
- Private key in env: fine for local/dev; use a secrets manager in production.

---

## What I Learned

Building this as a portfolio project taught me:

- **Market microstructure** — How order books work, why YES+NO must sum to 1, and how arb emerges from temporary mispricing.
- **Atomic execution patterns** — Sequential legs with rollback is a real pattern; holding one leg is directional risk, not arb.
- **In-process vs. serverless** — Cron and serverless don't fit sub-minute scanning; `setInterval` in a long-lived process does, with tradeoffs.
- **Error handling in trading code** — Every failure path must be explicit: leg 2 fails → sell leg 1. No silent failures.
- **Separation of concerns** — Scanner finds; executor acts. Config drives behavior. Logs capture intent and outcome.
- **Honest scoping** — Building something that works end-to-end and admits its limitations is more valuable than overselling.

---

## Future Improvements

- [ ] **Logical arb scanner (Type 2)** — Hardcoded map of correlated markets (e.g. "Trump wins" ⊂ "Republican wins"); scan for subset violations.
- [ ] **Configurable scan interval** — Use `agent_config.scan_interval_seconds` instead of hardcoded 30s.
- [ ] **WebSocket order books** — When Polymarket supports it, subscribe for real-time depth instead of polling.
- [ ] **Market detail page** — `/market/[id]` with price history chart (sparkline of YES+NO over time).
- [ ] **Fill rate analytics** — Track % of opportunities that actually filled vs. stale by execution time.
- [ ] **Dedicated scanner process** — Run scanner as a separate Node service, decoupled from Next.js.
- [ ] **Tighter execution** — Consider FOK/IOC order types, faster fill detection.
- [ ] **Budget reset** — Cron or manual trigger to reset `daily_spent` at start of day.
