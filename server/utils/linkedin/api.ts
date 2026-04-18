const baseUrl = 'https://api.linkedin.com/v2'

/**
 * Fetches an access token using an authorization code
 */
export async function getAccessToken(code: string, redirectUri: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
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

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`)
  }

  return response.json() // { access_token, expires_in, refresh_token, refresh_token_expires_in }
}

/**
 * Refreshes an access token
 */
export async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
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

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`)
  }

  return response.json()
}

export async function getPersonalUrn(accessToken: string) {
  const response = await fetch(`${baseUrl}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Failed to fetch user info: ${await response.text()}`)
  const data = await response.json()

  let urn = data.sub
  if (urn && !urn.startsWith('urn:li:person:')) {
    urn = `urn:li:person:${urn}`
  }
  return urn
}

export async function getPagesUrn(accessToken: string) {
  const response = await fetch(`${baseUrl}/organizationalEntityAcls?q=roleAssignee`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })
  if (!response.ok) throw new Error(`Failed to fetch pages: ${await response.text()}`)
  const data = await response.json()
  const org = data.elements?.[0]?.organization
  if (!org) throw new Error('No organization found for this user.')
  return org
}

/**
 * Creates a post on LinkedIn
 */
export async function createPost(
  accessToken: string,
  authorUrn: string,
  text: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/ugcPosts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${await response.text()}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
  throw new Error('Failed to create post after max retries')
}

/**
 * Fetches engagement metrics for a given post
 */
export async function getPostMetrics(accessToken: string, shareUrn: string) {
  const response = await fetch(`${baseUrl}/socialActions/${encodeURIComponent(shareUrn)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${await response.text()}`)
  }

  const data = await response.json()
  return {
    likes: data.likesSummary?.totalLikes || 0,
    comments: data.commentsSummary?.totalComments || 0,
    impressions: 0,
    clicks: 0,
  }
}
