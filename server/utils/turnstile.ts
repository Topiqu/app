import type { H3Event } from 'h3'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

export const verifyTurnstile = async (event: H3Event, token: string | undefined): Promise<boolean> => {
  const secret = useRuntimeConfig().turnstile?.secretKey
  if (!secret) return true
  if (!token) return false

  try {
    const res = await $fetch<TurnstileResponse, string>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      signal: AbortSignal.timeout(5000),
      retry: 0,
      method: 'POST',
      body: { secret, response: token, remoteip: getIp(event) },
    })
    return res.success === true
  } catch {
    await reportCaughtError('Turnstile verification unavailable', new Error('TURNSTILE_UNAVAILABLE')).catch(() => {})
    return false
  }
}
