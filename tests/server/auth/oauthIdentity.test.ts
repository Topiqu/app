import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  canLinkOAuthIdentity,
  isOAuthSignIn,
  verifiedGitHubEmail,
  verifiedGoogleEmail,
} from '../../../server/utils/oauthIdentity'

describe('isOAuthSignIn', () => {
  it('rejects the credentials account next-auth builds in callback.js', () => {
    expect(isOAuthSignIn({ providerAccountId: 'u1', type: 'credentials', provider: 'credentials' })).toBe(false)
  })

  it('accepts a real OAuth account', () => {
    expect(isOAuthSignIn({ provider: 'google', type: 'oauth', providerAccountId: '123' })).toBe(true)
  })

  it('rejects a missing account, as on token refresh', () => {
    expect(isOAuthSignIn(undefined)).toBe(false)
    expect(isOAuthSignIn(null)).toBe(false)
  })

  it('is not fooled by a truthy provider alone', () => {
    expect(isOAuthSignIn({ provider: 'credentials' } as { type?: string })).toBe(false)
  })
})

describe('verifiedGitHubEmail', () => {
  it('accepts the primary verified address', () => {
    const emails = [
      { email: 'other@x.com', primary: false, verified: true },
      { email: 'me@x.com', primary: true, verified: true },
    ]
    expect(verifiedGitHubEmail(emails)).toBe('me@x.com')
  })

  it('rejects an unverified primary address', () => {
    expect(verifiedGitHubEmail([{ email: 'victim@x.com', primary: true, verified: false }])).toBeNull()
  })

  it('never falls back to the first address when nothing is verified', () => {
    const emails = [
      { email: 'victim@x.com', primary: false, verified: false },
      { email: 'attacker@x.com', primary: false, verified: false },
    ]
    expect(verifiedGitHubEmail(emails)).toBeNull()
  })

  it('does not accept a verified but non-primary address', () => {
    expect(verifiedGitHubEmail([{ email: 'alt@x.com', primary: false, verified: true }])).toBeNull()
  })

  it('survives a non-array payload from the GitHub API', () => {
    expect(verifiedGitHubEmail(undefined)).toBeNull()
    expect(verifiedGitHubEmail({ message: 'Bad credentials' })).toBeNull()
    expect(verifiedGitHubEmail([])).toBeNull()
  })

  it('ignores entries whose truthiness is faked with strings', () => {
    expect(verifiedGitHubEmail([{ email: 'x@x.com', primary: 'true', verified: 'true' }])).toBeNull()
  })
})

describe('verifiedGoogleEmail', () => {
  it('accepts a verified address', () => {
    expect(verifiedGoogleEmail({ email: 'me@x.com', email_verified: true })).toBe('me@x.com')
  })

  it('rejects an unverified address', () => {
    expect(verifiedGoogleEmail({ email: 'victim@x.com', email_verified: false })).toBeNull()
  })

  it('rejects a missing email_verified claim', () => {
    expect(verifiedGoogleEmail({ email: 'victim@x.com' })).toBeNull()
  })

  it('rejects the string "true" as a verification claim', () => {
    expect(verifiedGoogleEmail({ email: 'victim@x.com', email_verified: 'true' })).toBeNull()
  })
})

describe('canLinkOAuthIdentity', () => {
  it('allows a fresh signup with no existing account', () => {
    expect(canLinkOAuthIdentity(null)).toBe(true)
  })

  it('allows linking to a verified local account', () => {
    expect(canLinkOAuthIdentity({ emailVerified: true })).toBe(true)
  })

  it('refuses linking to an unverified local account (password squatter)', () => {
    expect(canLinkOAuthIdentity({ emailVerified: false })).toBe(false)
  })
})

describe('the OAuth handler wires the guards in', () => {
  const source = readFileSync(resolve(process.cwd(), 'server/api/auth/[...].ts'), 'utf8')

  it('resolves the GitHub address through the verified-only helper', () => {
    expect(source).toContain('verifiedGitHubEmail(emails)')
    expect(source).not.toContain('emails[0]?.email')
  })

  it('honours the Google email_verified claim', () => {
    expect(source).toContain('verifiedGoogleEmail(profile)')
  })

  it('refuses an OAuth identity that carries no verified email', () => {
    expect(source).toContain("throw new Error('oauth_email_unverified')")
  })

  it('gates account linking and excludes soft-deleted accounts', () => {
    expect(source).toContain('canLinkOAuthIdentity(existingUser)')
    expect(source).toContain('findFirst({ where: { email: token.email, deletedAt: null } })')
  })

  it('gates the OAuth branch on account.type, never on the truthy account.provider', () => {
    expect(source).toContain('isOAuthSignIn(account)')
    expect(source).not.toContain('if (account?.provider)')
  })
})
