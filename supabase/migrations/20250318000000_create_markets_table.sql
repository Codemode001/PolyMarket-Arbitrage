-- Add missing columns to markets table for Polymarket arb agent
-- Run this in Supabase SQL Editor. Preserves existing data.

-- Add columns if they don't exist (PostgreSQL 9.4+)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS condition_id text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yes_price numeric;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS no_price numeric;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yes_token_id text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS no_token_id text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS volume numeric;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS end_date timestamptz;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS closed boolean DEFAULT false;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique constraint on condition_id for upsert (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'markets_condition_id_key'
  ) THEN
    ALTER TABLE markets ADD CONSTRAINT markets_condition_id_key UNIQUE (condition_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN NULL; -- constraint already exists
END $$;

-- Indexes for common queries (IF NOT EXISTS requires PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active);
CREATE INDEX IF NOT EXISTS idx_markets_volume ON markets(volume DESC);
