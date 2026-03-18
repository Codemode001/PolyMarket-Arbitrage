import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_config')
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Config not found' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const supabase = createClient()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Whitelist of updatable fields
  const allowed = new Set([
    'mode',
    'daily_budget',
    'daily_spent',
    'arb_max_per_trade',
    'arb_min_profit_pct',
    'is_running',
  ])

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) updates[key] = value
  }

  const { data, error } = await supabase
    .from('agent_config')
    .update(updates)
    .not('id', 'is', null)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
