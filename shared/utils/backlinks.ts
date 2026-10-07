import { toHostname } from './domain'

export type BacklinkOpportunityKind = 'UNLINKED_MENTION' | 'SUPPLIER'
export type BacklinkOpportunityStatus = 'OPEN' | 'SENT' | 'WON' | 'DISMISSED' | 'EXPIRED'

export const BACKLINK_DAY_MS = 86_400_000
/** Paid discovery runs monthly; a manual run is allowed after a week. */
export const BACKLINK_DISCOVERY_DAYS = 30
export const BACKLINK_MANUAL_DAYS = 7
/** A sent request without a link after this many days stops being checked. */
export const BACKLINK_SENT_DAYS = 60
export const BACKLINK_CHECK_DAYS = 7
/** Misses in a row before a link counts as lost: one failed render must not cry wolf. */
export const BACKLINK_LOST_AFTER = 2

const ALL_KINDS: BacklinkOpportunityKind[] = ['UNLINKED_MENTION', 'SUPPLIER']

export const backlinkAllowance = (plan: string | null | undefined) => {
  if (plan === 'PREMIUM' || plan === 'CUSTOM') return { kinds: ALL_KINDS, drafts: true }
  if (plan === 'PRO') return { kinds: ['UNLINKED_MENTION'] as BacklinkOpportunityKind[], drafts: false }
  return { kinds: [] as BacklinkOpportunityKind[], drafts: false }
}

const urlHost = (value: string | null | undefined) => {
  if (!value) return null
  try {
    return toHostname(new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname)
  } catch {
    return null
  }
}

/** The blog host and the company website given at sign-up: a link to either counts. */
export const ownedHosts = (site: { domain: string; websiteUrl?: string | null }) => [
  ...new Set([urlHost(site.domain), urlHost(site.websiteUrl)].filter((host): host is string => !!host)),
]

export const isOwnedHost = (host: string, owned: readonly string[]) => {
  const candidate = toHostname(host)
  return owned.some((root) => candidate === root || candidate.endsWith(`.${root}`))
}

/** Where a link should point: the company website when there is one, the blog otherwise. */
export const backlinkTarget = (site: { domain: string; websiteUrl?: string | null }) => {
  const website = urlHost(site.websiteUrl)
  return website ? `https://${website}/` : `https://${urlHost(site.domain) ?? site.domain}/`
}

/** Case- and accent-insensitive, so "Káva Praha" matches "KAVA praha". */
export const foldText = (value: string) =>
  value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/\s+/g, ' ')

export const mentionsTerm = (text: string, term: string) => {
  const needle = foldText(term).trim()
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(foldText(text))
}

export const isFollowed = (rel: readonly string[]) =>
  !rel.some((value) => ['nofollow', 'sponsored', 'ugc'].includes(value))
