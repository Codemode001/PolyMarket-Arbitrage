-- Align Supabase schema with codebase expectations. Run after base migrations.

-- agent_logs: code uses `message`, schema may have `event`
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS message text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_logs' AND column_name = 'event') THEN
    UPDATE agent_logs SET message = event WHERE message IS NULL AND event IS NOT NULL;
  END IF;
END $$;

-- arb_opportunities: code uses `market_id` (condition_id for yes_no); schema has market_id_a
ALTER TABLE arb_opportunities ADD COLUMN IF NOT EXISTS market_id text;
-- token_id_a NOT NULL: scanner must insert it; make nullable for existing rows then enforce via code
ALTER TABLE arb_opportunities ALTER COLUMN token_id_a DROP NOT NULL;

-- bets: code inserts token_id, side, order_id, price, size, amount_usdc, created_at
ALTER TABLE bets ADD COLUMN IF NOT EXISTS token_id text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS side text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS size numeric;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS amount_usdc numeric;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- arb_executions: code uses bet_id_a, bet_id_b, size_usdc, expected_profit_usdc, market_id
ALTER TABLE arb_executions ADD COLUMN IF NOT EXISTS bet_id_a uuid REFERENCES bets(id);
ALTER TABLE arb_executions ADD COLUMN IF NOT EXISTS bet_id_b uuid REFERENCES bets(id);
ALTER TABLE arb_executions ADD COLUMN IF NOT EXISTS size_usdc numeric;
ALTER TABLE arb_executions ADD COLUMN IF NOT EXISTS expected_profit_usdc numeric;
ALTER TABLE arb_executions ADD COLUMN IF NOT EXISTS market_id text;
-- Ensure total_staked/expected_profit have defaults so inserts without them succeed
ALTER TABLE arb_executions ALTER COLUMN total_staked SET DEFAULT 0;
ALTER TABLE arb_executions ALTER COLUMN expected_profit SET DEFAULT 0;

-- price_snapshots: code inserts market_id, yes_price, no_price, combined_price, created_at
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS combined_price numeric;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- token_id: make nullable for rows that only have yes_price; new inserts include it
ALTER TABLE price_snapshots ALTER COLUMN token_id DROP NOT NULL;
