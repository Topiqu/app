interface GitHubEmail {
  email?: unknown
  primary?: unknown
  verified?: unknown
}

export const verifiedGitHubEmail = (emails: unknown): string | null => {
  if (!Array.isArray(emails)) return null

  const primary = (emails as GitHubEmail[]).find(
    (entry) => typeof entry?.email === 'string' && entry.primary === true && entry.verified === true,
  )

  return (primary?.email as string) ?? null
}

export const verifiedGoogleEmail = (profile: { email?: string | null; email_verified?: unknown }): string | null =>
  profile.email_verified === true && profile.email ? profile.email : null

export const canLinkOAuthIdentity = (existing: { emailVerified: boolean } | null): boolean =>
  existing === null || existing.emailVerified === true

export const isOAuthSignIn = <T extends { type?: string }>(account: T | null | undefined): account is T =>
  account?.type === 'oauth'
