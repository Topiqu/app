export async function fetchGitHubOAuthResource(resource: 'profile' | 'emails', accessToken: string) {
  let response: Response
  try {
    response = await fetch(`https://api.github.com/user${resource === 'emails' ? '/emails' : ''}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Topiqu',
      },
    })
  } catch {
    throw new Error(`GitHub ${resource} request failed`)
  }
  if (!response.ok) throw new Error(`GitHub ${resource} HTTP ${response.status}`)
  try {
    const data = await response.json()
    if (resource === 'emails' ? !Array.isArray(data) : !data || !data.id) throw new Error()
    return data
  } catch {
    throw new Error(`GitHub ${resource} invalid response`)
  }
}
