interface Props {
  value: number | null
  prefix?: string
}

export function ProfitBadge({ value, prefix = '$' }: Props) {
  if (value == null || value === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-500">
        —
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-900/60 text-emerald-400">
        +{prefix}{value.toFixed(4)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-red-900/50 text-red-400">
      -{prefix}{Math.abs(value).toFixed(4)}
    </span>
  )
}
