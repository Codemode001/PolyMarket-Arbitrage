-- arb_opportunities already exists (see docs/schema.md) with found_at, market_id_a, etc.
-- Add created_at for code that expects it; index created_at for the opportunities API.
ALTER TABLE arb_opportunities ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill created_at from found_at where null
UPDATE arb_opportunities SET created_at = found_at WHERE created_at IS NULL AND found_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_arb_opportunities_created_at ON arb_opportunities(created_at DESC);
