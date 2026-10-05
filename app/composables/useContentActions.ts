export type ContentActionCommand = 'prepare' | 'apply' | 'dismiss' | 'rollback'

export type ContentActionStatus = 'SUGGESTED' | 'QUEUED' | 'READY' | 'APPLIED' | 'FAILED'

export interface ContentActionView {
  id: string
  type: 'REFRESH' | 'EXPAND'
  status: ContentActionStatus
  keyword: string
  reason: string | null
  angle: string | null
  positionBefore: number | null
  positionAfter: number | null
  measuredAt: string | null
  appliedAt: string | null
  error: string | null
  article: { id: string; title: string; slug: string }
  proposal: { title: string; excerpt: string | null; content: string; summary: string[]; changed: number } | null
}

interface ContentActions {
  allowed: boolean
  monthly: number
  used: number
  actions: ContentActionView[]
}

/** Suggested article updates; refetched while one is being prepared, so it turns ready on its own. */
export const useContentActions = () => {
  const query = useQuery({
    key: () => queryKeys.contentActions.list,
    // Typed by hand: inferring it from the route table exceeds TypeScript's depth limit.
    query: () => $fetch<ContentActions>('/api/content-actions'),
  })
  const preparing = computed(() => query.data.value?.actions.some((action) => action.status === 'QUEUED') ?? false)
  const { pause, resume } = useIntervalFn(() => query.refetch(), 15_000, { immediate: false })
  watch(preparing, (active) => (active ? resume() : pause()), { immediate: true })
  return query
}
