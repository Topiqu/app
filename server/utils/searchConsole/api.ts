const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://www.googleapis.com/webmasters/v3'

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  id_token?: string
}

const credentials = () => {
  const clientId = searchConsoleClientId()
  const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET
  if (!clientId || !clientSecret) throw new Error('Google Search Console OAuth is not configured')
  return { clientId, clientSecret }
}

export const searchConsoleClientId = () =>
  process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || ''

export const exchangeSearchConsoleCode = async (code: string, redirectUri: string): Promise<GoogleTokens> => {
  const { clientId, clientSecret } = credentials()
  return await $fetch<GoogleTokens>(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
}

export const refreshSearchConsoleAccess = async (refreshToken: string): Promise<string> => {
  const { clientId, clientSecret } = credentials()
  const result = await $fetch<GoogleTokens>(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  return result.access_token
}

export const listSearchConsoleSites = async (accessToken: string) => {
  const result = await $fetch<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(`${API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return result.siteEntry ?? []
}

export const getGoogleIdentity = async (accessToken: string) =>
  await $fetch<{ sub: string; email?: string }>('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

export const searchConsoleRedirectUri = () =>
  `${useRuntimeConfig().public.siteUrl || 'http://localhost:3000'}/api/search-console/callback`

export const chooseSearchConsoleProperty = (domain: string, sites: { siteUrl: string; permissionLevel: string }[]) => {
  const normalized = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  return (
    sites.find((site) => site.siteUrl === `sc-domain:${normalized}`) ??
    sites.find(
      (site) =>
        site.siteUrl
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '') === normalized,
    ) ??
    null
  )
}

export interface SearchConsoleRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}
export const querySearchConsole = async (
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
) => {
  const encoded = encodeURIComponent(propertyUrl)
  const result = await $fetch<{ rows?: SearchConsoleRow[] }>(`${API_BASE}/sites/${encoded}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { startDate, endDate, dimensions: ['date', 'page', 'query'], rowLimit: 25000, dataState: 'final' },
  })
  return result.rows ?? []
}
