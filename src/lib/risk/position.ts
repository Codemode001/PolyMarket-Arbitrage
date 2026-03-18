const MINIMUM_BET = 5 // never go below $5

/**
 * Returns a safe bet size for one leg of an arb trade.
 *
 * Conservative by design — start small to validate fills in production.
 * Scale up only after confirmed fills are working.
 *
 * @param profitPct       - Expected arb profit as a decimal (e.g. 0.02 = 2%)
 * @param remainingBudget - Daily budget remaining in USDC
 * @param maxPerTrade     - Hard cap per single trade from agent_config
 * @returns Bet size in USDC (e.g. 5.00)
 */
export function calculateSize(
  profitPct: number,
  remainingBudget: number,
  maxPerTrade: number,
): number {
  if (profitPct <= 0) return 0
  if (remainingBudget < MINIMUM_BET) return 0

  // Conservative: start at $5, never exceed maxPerTrade or remaining budget
  const size = Math.min(MINIMUM_BET, maxPerTrade, remainingBudget)

  // Round to 2 decimal places (USDC)
  return Math.floor(size * 100) / 100
}
