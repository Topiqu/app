import { createSign } from 'node:crypto'

export interface GamServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

const GAM_SCOPE = 'https://www.googleapis.com/auth/admanager'
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token'
const JWT_LIFETIME_SECONDS = 3600
const EXPIRY_SKEW_SECONDS = 120

let cachedToken: { value: string; expiresAtMs: number } | null = null

export const parseServiceAccountKey = (raw: string): GamServiceAccountKey => {
  const trimmed = raw.trim()
  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8')

  let parsed: Partial<GamServiceAccountKey>
  try {
    parsed = JSON.parse(json)
  } catch {
    throw createError({ statusCode: 500, message: 'GAM_SERVICE_ACCOUNT_KEY is not valid JSON (raw or base64)' })
  }

  if (!parsed.client_email || !parsed.private_key)
    throw createError({ statusCode: 500, message: 'GAM_SERVICE_ACCOUNT_KEY is missing client_email or private_key' })

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri || DEFAULT_TOKEN_URI,
  }
}

const base64Url = (input: string): string => Buffer.from(input, 'utf8').toString('base64url')

export const buildAssertion = (key: GamServiceAccountKey, nowSeconds: number): string => {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(
    JSON.stringify({
      iss: key.client_email,
      scope: GAM_SCOPE,
      aud: key.token_uri || DEFAULT_TOKEN_URI,
      iat: nowSeconds,
      exp: nowSeconds + JWT_LIFETIME_SECONDS,
    }),
  )

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  signer.end()

  return `${header}.${claims}.${signer.sign(key.private_key, 'base64url')}`
}

export const getGamAccessToken = async (): Promise<string> => {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAtMs > now) return cachedToken.value

  const raw = process.env.GAM_SERVICE_ACCOUNT_KEY
  if (!raw) throw createError({ statusCode: 500, message: 'GAM_SERVICE_ACCOUNT_KEY is not set' })

  const key = parseServiceAccountKey(raw)
  const assertion = buildAssertion(key, Math.floor(now / 1000))

  const token = await $fetch<TokenResponse>(key.token_uri || DEFAULT_TOKEN_URI, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
    retry: 1,
  })

  if (!token?.access_token)
    throw createError({ statusCode: 502, message: 'GAM token endpoint returned no access_token' })

  cachedToken = {
    value: token.access_token,
    expiresAtMs: now + Math.max(0, (token.expires_in ?? JWT_LIFETIME_SECONDS) - EXPIRY_SKEW_SECONDS) * 1000,
  }

  return cachedToken.value
}

export const resetGamTokenCache = (): void => {
  cachedToken = null
}
