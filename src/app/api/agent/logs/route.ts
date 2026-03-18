import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('agent_logs')
    .select('id, level, message, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('agent/logs error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return in ascending order so feed renders oldest→newest
  const logs = (data ?? []).reverse()
  return NextResponse.json({ logs })
}
