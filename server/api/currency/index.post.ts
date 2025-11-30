interface CNBRate {
  country: string
  currency: string
  amount: number
  currencyCode: string
  rate: number
}

interface CNBResponse {
  rates: CNBRate[]
}

export default defineEventHandler(async (event) => {
  const { target = 'EUR' } = await readBody(event)
  const code = target.toUpperCase()

  if (code === 'CZK') return { rate: 1 }

  const { rates } = await $fetch<CNBResponse>('https://api.cnb.cz/cnbapi/exrates/daily')
  const found = rates.find((r) => r.currencyCode === code)

  return { rate: found?.rate ?? 1 }
})
