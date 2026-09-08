import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { Issuer, TokenSet } from 'openid-client'
import { describe, expect, it, vi } from 'vitest'

// Read the setting from the actual provider, so deleting it recreates the production failure.
const source = readFileSync(resolve(process.cwd(), 'server/api/auth/[...].ts'), 'utf8')
const githubProvider = source.split('function GitHubProvider')[1]?.split('const Credentials')[0] ?? ''
const configuredIssuer = githubProvider.match(/issuer:\s*'([^']+)'/)?.[1]
const redirectUri = 'https://app.topiqu.com/api/auth/callback/github'

function createClient(issuer = configuredIssuer) {
  const server = new Issuer({ issuer: issuer!, token_endpoint: 'https://github.com/login/oauth/access_token' })
  const client = new server.Client({ client_id: 'test', client_secret: 'test' })
  const grant = vi.spyOn(client, 'grant').mockResolvedValue(new TokenSet({ access_token: 'test-token' }))
  return { client, grant }
}

describe('GitHub OAuth issuer validation', () => {
  it('accepts the GitHub iss parameter and reaches the code exchange', async () => {
    const { client, grant } = createClient()
    const tokens = await client.oauthCallback(
      redirectUri,
      {
        code: 'test-code',
        state: 'test-state',
        iss: 'https://github.com/login/oauth',
      },
      { state: 'test-state' },
    )
    expect(tokens.access_token).toBe('test-token')
    expect(grant).toHaveBeenCalledOnce()
  })

  it('rejects a different issuer before exchanging the code', async () => {
    const { client, grant } = createClient()
    await expect(
      client.oauthCallback(
        redirectUri,
        {
          code: 'test-code',
          state: 'test-state',
          iss: 'https://untrusted.example',
        },
        { state: 'test-state' },
      ),
    ).rejects.toThrow('iss mismatch')
    expect(grant).not.toHaveBeenCalled()
  })

  it('still accepts callbacks without the optional iss parameter', async () => {
    const { client } = createClient()
    await expect(
      client.oauthCallback(
        redirectUri,
        {
          code: 'test-code',
          state: 'test-state',
        },
        { state: 'test-state' },
      ),
    ).resolves.toHaveProperty('access_token', 'test-token')
  })

  it('still rejects a mismatched state', async () => {
    const { client, grant } = createClient()
    await expect(
      client.oauthCallback(
        redirectUri,
        {
          code: 'test-code',
          state: 'wrong-state',
          iss: 'https://github.com/login/oauth',
        },
        { state: 'test-state' },
      ),
    ).rejects.toThrow('state mismatch')
    expect(grant).not.toHaveBeenCalled()
  })
})
