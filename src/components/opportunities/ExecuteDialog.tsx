'use client'

import { useState } from 'react'
import { OpportunityRow } from './OpportunityTable'

interface Props {
  opportunity: OpportunityRow
  onClose: () => void
  onExecuted: (id: string) => void
}

type ExecState = 'idle' | 'executing' | 'success' | 'error'

const SUGGESTED_SIZE = 5 // $5 default, matches calculateSize conservative start

export function ExecuteDialog({ opportunity: opp, onClose, onExecuted }: Props) {
  const [state, setState] = useState<ExecState>('idle')
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const combinedPct = (opp.combined_price * 100).toFixed(2)
  const profitPct = (opp.expected_profit_pct * 100).toFixed(2)
  const profitDollars = (SUGGESTED_SIZE * 2 * opp.expected_profit_pct).toFixed(4)

  async function handleExecute() {
    setState('executing')
    setResultMsg(null)

    try {
      const res = await fetch('/api/arb/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opp.id }),
      })

      const json = await res.json()

      if (res.ok) {
        setState('success')
        setResultMsg(`Both legs filled. Expected profit: $${json.expectedProfit?.toFixed(4) ?? profitDollars}`)
        onExecuted(opp.id)
      } else {
        setState('error')
        setResultMsg(json.error ?? 'Execution failed')
      }
    } catch (e) {
      setState('error')
      setResultMsg(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 shadow-2xl font-mono">
        {/* Header */}
        <div className="border-b border-zinc-800 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Execute Arb Trade</p>
            <p className="text-sm text-zinc-200 leading-snug line-clamp-2" title={opp.question}>
              {opp.question}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-400 text-lg leading-none flex-shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Pricing details */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">YES Ask (Leg 1)</p>
              <p className="text-emerald-400 font-bold text-lg">
                {(opp.price_a * 100).toFixed(1)}¢
              </p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">NO Ask (Leg 2)</p>
              <p className="text-emerald-400 font-bold text-lg">
                {(opp.price_b * 100).toFixed(1)}¢
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">Combined</p>
              <p className="text-white font-bold">{combinedPct}¢</p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">Profit %</p>
              <p className="text-emerald-400 font-bold">+{profitPct}%</p>
            </div>
            <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
              <p className="text-xs text-zinc-500 mb-1">Est. Profit $</p>
              <p className="text-emerald-400 font-bold">+${profitDollars}</p>
            </div>
          </div>

          <div className="bg-zinc-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-zinc-500">Suggested size (each leg)</p>
            <p className="text-zinc-200 font-bold">${SUGGESTED_SIZE}.00</p>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed">
            Leg 1 (YES) will be placed first. If Leg 1 fills, Leg 2 (NO) is placed
            immediately. If Leg 2 fails, Leg 1 is sold back at market automatically.
          </p>
        </div>

        {/* Result message */}
        {resultMsg && (
          <div
            className={`mx-5 mb-3 px-3 py-2 rounded-lg text-xs ${
              state === 'success'
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800'
                : 'bg-red-900/40 text-red-400 border border-red-900'
            }`}
          >
            {resultMsg}
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-zinc-800 px-5 py-4 flex gap-3">
          {state === 'success' ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-emerald-900 text-emerald-200 text-sm font-bold"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={state === 'executing'}
                className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm disabled:opacity-40 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleExecute}
                disabled={state === 'executing'}
                className="flex-1 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {state === 'executing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing…
                  </span>
                ) : (
                  'Execute'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
