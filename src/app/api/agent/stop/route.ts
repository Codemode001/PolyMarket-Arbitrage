import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stopAgent } from '@/lib/agent/loop'

export async function POST() {
  const supabase = createClient()

  await supabase
    .from('agent_config')
    .update({ is_running: false, updated_at: new Date().toISOString() })
    .not('id', 'is', null)

  stopAgent()

  await supabase.from('agent_logs').insert({
    event: 'Agent stopped',
    level: 'info',
    message: 'Agent stopped',
    payload: {},
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({ stopped: true })
}
