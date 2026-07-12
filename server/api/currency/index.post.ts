interface CNBResponse {
  rates: FxRate[]
}

export default defineEventHandler(async (event) => {
  const { target = 'USD' } = await readBody(event)
  const code = target.toUpperCase()

  if (code === 'USD') return { rate: 1 }

  const { rates } = await $fetch<CNBResponse>('https://api.cnb.cz/cnbapi/exrates/daily')

  return { rate: usdCrossRate(rates, code) }
})
