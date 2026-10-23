import type { MaybeRefOrGetter } from 'vue'

import type { AsyncDataOptions, NuxtApp } from '#app'

type FollowCacheContext = Parameters<NonNullable<AsyncDataOptions<unknown>['getCachedData']>>[2]

const cachedFollowStatus = (key: string, app: NuxtApp, context: FollowCacheContext) =>
  context.cause === 'refresh:manual' ? undefined : app.isHydrating ? app.payload.data[key] : app.static.data[key]

// A cached computed must not retain an input getter from a page setup scope.
function useFollowTarget(authorId: MaybeRefOrGetter<string | null | undefined>) {
  const target = shallowRef(toValue(authorId) ?? '')
  watch(
    () => toValue(authorId),
    (value) => {
      target.value = value ?? ''
    },
    { flush: 'sync' },
  )
  return target
}

/** Reads one author's follow state; full profile lists remain owned by FollowDialog. */
export function useFollowStatus(authorId: MaybeRefOrGetter<string | null | undefined>) {
  const { data: session } = useAuth()
  const requestFetch = useRequestFetch()
  const viewer = computed(() => session.value?.user.id ?? '')
  const target = useFollowTarget(authorId)
  const enabled = computed(() => !!viewer.value && !!target.value)
  const state = useAsyncData(
    computed(() => `follow-status:${viewer.value}:${target.value}`),
    async (_app, { signal }) => {
      const owner = viewer.value
      const followedId = target.value
      const rows = await requestFetch<{ id: string }[], '/api/follows/followed'>('/api/follows/followed', {
        query: { followedId },
        signal,
      })
      return { owner, followedId, following: rows.some((row) => row.id === followedId) }
    },
    {
      lazy: true,
      deep: false,
      enabled,
      getCachedData: cachedFollowStatus,
    },
  )
  const matches = computed(
    () => enabled.value && state.data.value?.owner === viewer.value && state.data.value.followedId === target.value,
  )
  const known = computed(() => matches.value && state.status.value === 'success')
  return {
    known,
    isFollowing: computed(() => matches.value && !!state.data.value?.following),
    pending: computed(() => enabled.value && !known.value && !state.error.value),
    error: state.error,
    refresh: () => state.refresh(),
  }
}
