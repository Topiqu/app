import { z } from 'zod'

// CNB publishes one table per working day and every target derives from it, so cache the table, not the answer.
const cnbRates = defineCachedFunction(
  async () => (await $fetch<{ rates: FxRate[] }>('https://api.cnb.cz/cnbapi/exrates/daily')).rates,
  { name: 'cnb-rates', maxAge: 60 * 60 * 6, swr: true },
)

const querySchema = z.object({
  target: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .default('USD'),
})

export default defineEventHandler(async (event) => {
  const { target } = await getValidatedQuery(event, querySchema.parse)
  const code = target.toUpperCase()
  return { rate: code === 'USD' ? 1 : usdCrossRate(await cnbRates(), code) }
})
