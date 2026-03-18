'use client'

interface Props {
  spent: number
  budget: number
}

export function BudgetMeter({ spent, budget }: Props) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const remaining = Math.max(budget - spent, 0)

  const barColor =
    pct > 80
      ? 'bg-red-500'
      : pct > 50
        ? 'bg-yellow-500'
        : 'bg-emerald-500'

  const textColor =
    pct > 80
      ? 'text-red-400'
      : pct > 50
        ? 'text-yellow-400'
        : 'text-emerald-400'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 uppercase tracking-widest">Daily Budget</span>
        <span className="text-zinc-500">
          <span className={`font-mono font-bold ${textColor}`}>${spent.toFixed(2)}</span>
          <span className="text-zinc-600"> of </span>
          <span className="font-mono text-zinc-400">${budget.toFixed(2)}</span>
          <span className="text-zinc-600"> used today</span>
          <span className="ml-3 text-zinc-500 font-mono">(${remaining.toFixed(2)} remaining)</span>
        </span>
      </div>

      {/* Track */}
      <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-end">
        <span className={`text-xs font-mono font-bold ${textColor}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
