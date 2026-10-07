import type { BacklinkOpportunityKind, BacklinkOpportunityStatus } from '~~/shared/utils/backlinks'

export type BacklinkCommand = 'draft' | 'sent' | 'dismiss' | 'reopen' | 'check'

export interface BacklinkDraft {
  subject: string
  body: string
}

export interface BacklinkOpportunityView {
  id: string
  kind: BacklinkOpportunityKind
  status: Extract<BacklinkOpportunityStatus, 'OPEN' | 'SENT'>
  sourceUrl: string
  sourceDomain: string
  title: string | null
  evidence: Record<string, unknown>
  targetUrl: string
  contactUrl: string | null
  draft: BacklinkDraft | null
  sentAt: string | null
  createdAt: string
}

export interface BacklinkView {
  id: string
  sourceUrl: string
  sourceDomain: string
  targetUrl: string
  rel: string[]
  anchor: string | null
  firstSeenAt: string
  lastSeenAt: string
  lostAt: string | null
  opportunityId: string | null
}

interface Backlinks {
  allowance: { kinds: BacklinkOpportunityKind[]; drafts: boolean }
  available: boolean
  refreshedAt: string | null
  running: boolean
  nextManualAt: string | null
  won: number
  opportunities: BacklinkOpportunityView[]
  links: BacklinkView[]
}

/** One request for the page; refetched while a discovery runs, so results appear on their own. */
export const useBacklinks = () => {
  const query = useQuery({
    key: () => queryKeys.backlinks.list,
    // Typed by hand: inferring it from the route table exceeds TypeScript's depth limit.
    query: () => $fetch<Backlinks>('/api/backlinks'),
  })
  const running = computed(() => query.data.value?.running ?? false)
  const { pause, resume } = useIntervalFn(() => query.refetch(), 15_000, { immediate: false })
  watch(running, (active) => (active ? resume() : pause()), { immediate: true })
  return query
}
