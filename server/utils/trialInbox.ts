const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/** One spelling per inbox: `+tags` are dropped everywhere; Gmail also ignores dots. */
export const canonicalEmail = (email: string): string => {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@')
  const base = local.split('+')[0] ?? ''
  return GMAIL_DOMAINS.has(domain) ? `${base.replaceAll('.', '')}@gmail.com` : `${base}@${domain}`
}

/**
 * Whether the inbox behind `email` already owns a site, i.e. already had its trial. The SQL must
 * mirror `canonicalEmail`. Users are only soft-deleted, so a deleted owner still counts.
 */
export const inboxOwnsSite = async (tx: DatabaseTransaction, email: string): Promise<boolean> => {
  const canonical = canonicalEmail(email)
  // Two alias sign-ups racing past the check would both be granted the trial.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trial-inbox:${canonical}`}))`
  const rows = await tx.$queryRaw<{ owns: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "User" u
      JOIN "TenantMembership" m ON m."userId" = u.id AND m.role = 'OWNER'
      WHERE CASE
        WHEN split_part(lower(u.email), '@', 2) IN ('gmail.com', 'googlemail.com')
          THEN replace(split_part(split_part(lower(u.email), '@', 1), '+', 1), '.', '') || '@gmail.com'
        ELSE split_part(split_part(lower(u.email), '@', 1), '+', 1) || '@' || split_part(lower(u.email), '@', 2)
      END = ${canonical}
    ) AS owns`
  return rows[0]?.owns === true
}
