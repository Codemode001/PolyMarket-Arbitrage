import { NextResponse } from 'next/server'
import { runScanner } from '@/lib/scanner'

export async function POST() {
  try {
    const opportunities = await runScanner()
    return NextResponse.json({ opportunities, count: opportunities.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scanner failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
