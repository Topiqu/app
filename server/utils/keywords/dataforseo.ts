import { $fetch } from 'ofetch'

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

/** Labs may return seed data and suggestions as separate results in the same task. */
export const dataForSeo = async <T>(path: string, task: Record<string, unknown>) => {
  const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')
  const response = await $fetch<DataForSeoResponse<T>>(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: [task],
    timeout: 60_000,
  })
  const result = response.tasks?.[0]
  // 20000 is DataForSEO's OK; anything else at either level means no usable data.
  if (response.status_code !== 20000 || result?.status_code !== 20000)
    throw new Error(`DataForSEO ${path}: ${result?.status_message ?? response.status_message}`)
  return { result: result.result?.[0] ?? null, results: result.result ?? [], cost: response.cost ?? 0 }
}
