import { $fetch } from 'ofetch'

import { reserveAiSpend, settleAiSpend } from '../ai/spend'

/**
 * Outside production every call goes to the free sandbox, which returns dummy data in the real shape,
 * so development never spends credit. `DATAFORSEO_SANDBOX=0|1` overrides that.
 */
const baseUrl = () => {
  const flag = process.env.DATAFORSEO_SANDBOX
  const sandbox = flag ? flag === '1' : process.env.NODE_ENV !== 'production'
  return sandbox ? 'https://sandbox.dataforseo.com/v3' : 'https://api.dataforseo.com/v3'
}

export const hasDataForSeo = () => Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)

interface DataForSeoResponse<T> {
  status_code: number
  status_message: string
  cost: number
  tasks?: { status_code: number; status_message: string; result: T[] | null }[]
}

// Held while the call runs (callers run five at once) and the most it can be charged. A live SERP page
// bills $0.002, a Labs task about $0.015.
const reservationMicros = (path: string) =>
  path.startsWith('/serp/') ? 20_000 : path.startsWith('/dataforseo_labs/') ? 50_000 : 200_000

/** Labs may return seed data and suggestions as separate results in the same task. */
export const dataForSeo = async <T>(path: string, task: Record<string, unknown>, clientSiteId?: string) => {
  const origin = baseUrl()
  const reservation =
    origin === 'https://api.dataforseo.com/v3'
      ? await reserveAiSpend('dataforseo', 'search', reservationMicros(path), clientSiteId, 'SEO')
      : null
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
  let response: DataForSeoResponse<T>
  try {
    response = await $fetch<DataForSeoResponse<T>>(`${origin}${path}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: [task],
      timeout: 60_000,
    })
  } catch (error) {
    if (reservation) await settleAiSpend(reservation, null)
    throw error
  }
  if (reservation)
    await settleAiSpend(
      reservation,
      typeof response.cost === 'number' && response.cost >= 0 ? Math.ceil(response.cost * 1_000_000) : null,
    )
  const result = response.tasks?.[0]
  // 20000 is DataForSEO's OK; anything else at either level means no usable data.
  if (response.status_code !== 20000 || result?.status_code !== 20000)
    throw new Error(`DataForSEO ${path}: ${result?.status_message ?? response.status_message}`)
  return { result: result.result?.[0] ?? null, results: result.result ?? [], cost: response.cost ?? 0 }
}
