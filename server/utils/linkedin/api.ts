import { z } from 'zod'

import { readLimitedBody } from '../images/publicFetch'

const baseUrl = 'https://api.linkedin.com/v2'
const restBaseUrl = 'https://api.linkedin.com/rest'
const linkedInVersion = process.env.LINKEDIN_API_VERSION || '202604'

export const isLinkedInPostUrn = (value: unknown): value is string =>
  typeof value === 'string' && /^urn:li:(?:share|ugcPost):\d{1,30}$/.test(value)

export class LinkedInPostError extends Error {
  constructor(
    readonly outcome: 'rejected' | 'unknown',
    readonly httpStatus?: number,
  ) {
    super(`LINKEDIN_POST_${outcome.toUpperCase()}${httpStatus ? `_${httpStatus}` : ''}`)
    this.name = 'LinkedInPostError'
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1).max(16_384),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).max(16_384).optional(),
  refresh_token_expires_in: z.number().int().nonnegative().optional(),
})

async function linkedInJson(url: string, init: RequestInit = {}): Promise<unknown> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      throw new Error('LINKEDIN_HTTP_ERROR')
    }
    return JSON.parse(new TextDecoder().decode(await readLimitedBody(response, 64 * 1024)))
  } catch {
    // OAuth bodies and errors may contain credentials; only safe codes escape.
    throw new Error('LINKEDIN_RESPONSE_UNAVAILABLE_OR_INVALID')
  }
}

const parseToken = (value: unknown) => {
  const parsed = tokenSchema.safeParse(value)
  if (!parsed.success) throw new Error('LINKEDIN_TOKEN_INVALID')
  return parsed.data
}

/**
 * Fetches an access token using an authorization code
 */
export async function getAccessToken(code: string, redirectUri: string, clientId: string, clientSecret: string) {
  const data = await linkedInJson('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  return parseToken(data)
}

/**
 * Refreshes an access token
 */
export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const data = await linkedInJson('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  return parseToken(data)
}

export async function getPersonalUrn(accessToken: string) {
  const data = await linkedInJson(`${baseUrl}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const parsed = z
    .object({
      sub: z
        .string()
        .max(128)
        .regex(/^(?:urn:li:person:)?[a-zA-Z0-9_-]+$/),
    })
    .safeParse(data)
  if (!parsed.success) throw new Error('LINKEDIN_PERSON_INVALID')
  return parsed.data.sub.startsWith('urn:li:person:') ? parsed.data.sub : `urn:li:person:${parsed.data.sub}`
}

/**
 * Creates a post on LinkedIn
 */
export async function createPost(accessToken: string, authorUrn: string, text: string): Promise<string> {
  let response: Response | undefined
  try {
    // The Posts API documents no idempotency key. Lost acknowledgements must be
    // reconciled; sending another POST can create a second public post.
    response = await fetch(`${restBaseUrl}/posts`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Linkedin-Version': linkedInVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    })
    if (response.status !== 201) {
      // 422 can mean a duplicate existing post; 408/409/429 and server errors do
      // not establish that publication was not applied. Keep these outcomes locked.
      const rejected = [400, 401, 403, 404, 405, 410, 411, 413, 414, 415, 426].includes(response.status)
      throw new LinkedInPostError(rejected ? 'rejected' : 'unknown', response.status)
    }
    const postId = response.headers.get('x-restli-id')
    if (!isLinkedInPostUrn(postId)) throw new LinkedInPostError('unknown', response.status)
    return postId
  } catch (error) {
    if (error instanceof LinkedInPostError) throw error
    throw new LinkedInPostError('unknown')
  } finally {
    // Successful creation is acknowledged in headers; its body is not needed.
    await response?.body?.cancel().catch(() => {})
  }
}

/**
 * @deprecated Personal-post metrics require restricted LinkedIn read access that Topiqu does
 * not currently hold. Kept as the future reactivation point; do not call from scheduled jobs.
 */
export async function getPostMetrics(accessToken: string, shareUrn: string) {
  const data = await linkedInJson(`${baseUrl}/socialActions/${encodeURIComponent(shareUrn)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })

  const parsed = z
    .object({
      likesSummary: z.object({ totalLikes: z.number().nonnegative().optional() }).optional(),
      commentsSummary: z.object({ totalComments: z.number().nonnegative().optional() }).optional(),
    })
    .safeParse(data)
  if (!parsed.success) throw new Error('LINKEDIN_METRICS_INVALID')
  return {
    likes: parsed.data.likesSummary?.totalLikes || 0,
    comments: parsed.data.commentsSummary?.totalComments || 0,
    impressions: 0,
    clicks: 0,
  }
}
