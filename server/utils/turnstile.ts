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
    const res = await $fetch<TurnstileResponse>(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: { secret, response: token, remoteip: getIp(event) },
      },
    )
    return res.success === true
  } catch {
    return false
  }
}
