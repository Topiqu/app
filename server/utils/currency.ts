export interface FxRate {
  currencyCode: string
  amount: number
  rate: number
}

export const usdCrossRate = (rates: FxRate[], target: string): number => {
  const code = target.toUpperCase()
  if (code === 'USD') return 1

  const usd = rates.find((r) => r.currencyCode === 'USD')
  if (!usd || usd.rate <= 0) return 1
  const czkPerUsd = usd.rate / usd.amount

  if (code === 'CZK') return czkPerUsd

  const found = rates.find((r) => r.currencyCode === code)
  if (!found || found.rate <= 0) return 1
  const czkPerTarget = found.rate / found.amount

  return czkPerUsd / czkPerTarget
}
