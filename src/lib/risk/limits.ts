import { createClient } from '@/lib/supabase/server'

export async function canPlaceBet(amount: number): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_config')
    .select('daily_budget, daily_spent, arb_max_per_trade')
    .single()

  if (error || !data) return false

  const dailyBudget = Number(data.daily_budget ?? 0)
  const dailySpent = Number(data.daily_spent ?? 0)
  const maxPerTrade = Number(data.arb_max_per_trade ?? 0)

  if (amount > maxPerTrade) return false
  if (dailySpent + amount > dailyBudget) return false

  return true
}

export async function recordSpend(amount: number): Promise<void> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_config')
    .select('daily_spent')
    .single()

  if (error || !data) throw new Error('Could not read agent_config')

  const newSpent = Number(data.daily_spent ?? 0) + amount

  await supabase
    .from('agent_config')
    .update({ daily_spent: newSpent, updated_at: new Date().toISOString() })
    .not('id', 'is', null)
}
