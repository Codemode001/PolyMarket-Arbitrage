import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startAgent, isAgentRunning } from '@/lib/agent/loop'

export async function POST() {
  const supabase = createClient()

  // Upsert ensures a row exists (avoids silent no-op when table is empty)
  const { error: configError } = await supabase
    .from('agent_config')
    .upsert(
      { id: 1, is_running: true, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (configError) {
    console.error('[agent/start] agent_config upsert failed:', configError.message)
  }

  await supabase.from('agent_logs').insert({
    event: 'Agent started',
    level: 'info',
    message: 'Agent started',
    payload: {},
    created_at: new Date().toISOString(),
  })

  if (!isAgentRunning()) {
    startAgent()
  }

  return NextResponse.json({ started: true })
}
