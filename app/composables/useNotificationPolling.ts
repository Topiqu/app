import type { NotificationCursor, NotificationPollResponse } from '~~/shared/types/notification'

type PollStatus = 'paused' | 'connecting' | 'active' | 'retrying' | 'forbidden' | 'unauthorized'

export const useNotificationPolling = <T>(options: {
  initialCursor: () => NotificationCursor | undefined
  receive: (response: NotificationPollResponse<T>) => void
  reset: () => void
}) => {
  const { data: auth, getSession } = useAuth()
  const visibility = useDocumentVisibility()
  const status = shallowRef<PollStatus>('connecting')
  const delay = shallowRef(10_000)
  let cursor: NotificationCursor | undefined
  let controller: AbortController | undefined
  let version = 0
  let failures = 0
  let refreshedSession = false
  let disposed = false
  let nextPollAt = 0
  const enabled = () => import.meta.client && !disposed && !!auth.value?.user && visibility.value === 'visible'
  const blocked = () => status.value === 'forbidden' || status.value === 'unauthorized'

  const schedule = (milliseconds: number) => {
    if (!enabled() || blocked()) return
    delay.value = Math.min(milliseconds, 2_147_483_647)
    nextPollAt = Date.now() + delay.value
    start()
  }

  const poll = async () => {
    if (!enabled() || blocked() || controller) return
    const request = new AbortController()
    controller = request
    const requestVersion = version
    const current = () => !disposed && version === requestVersion && !request.signal.aborted
    let nextDelay = 10_000
    try {
      cursor ??= options.initialCursor()
      const response = await $fetch<NotificationPollResponse<T>, '/api/notifications/poll'>('/api/notifications/poll', {
        query: cursor ? { since: cursor.createdAt, sinceId: cursor.id } : undefined,
        signal: request.signal,
        timeout: 15_000,
        retry: 0,
      })
      if (!current()) return
      options.receive(response)
      cursor = response.cursor
      failures = 0
      refreshedSession = false
      status.value = 'active'
      if (response.hasMore) nextDelay = 250
    } catch (error: unknown) {
      if (!current()) return
      const failure = error as { statusCode?: number; response?: { status: number; headers: Headers } }
      const code = failure?.statusCode ?? failure?.response?.status
      if (code === 403) status.value = 'forbidden'
      else if (code === 401 && refreshedSession) status.value = 'unauthorized'
      else if (code === 401) {
        try {
          const session = await getSession({ throwOnError: true })
          if (!current()) return
          refreshedSession = true
          status.value = session?.user ? 'connecting' : 'unauthorized'
          nextDelay = 250
        } catch {
          if (!current()) return
          status.value = 'retrying'
          nextDelay = Math.min(10_000 * 2 ** ++failures, 300_000)
        }
      } else {
        status.value = 'retrying'
        nextDelay = Math.min(10_000 * 2 ** ++failures, 300_000)
        const retryAfter = failure?.response?.headers?.get('retry-after')
        if (code === 429 && retryAfter) {
          const seconds = Number(retryAfter)
          const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
          if (Number.isFinite(wait)) nextDelay = Math.max(nextDelay, wait)
        }
      }
    } finally {
      if (controller === request) controller = undefined
      if (current()) schedule(nextDelay)
    }
  }

  const { start, stop } = useTimeoutFn(() => void poll(), delay, { immediate: false })
  const cancel = () => {
    version++
    stop()
    controller?.abort()
    controller = undefined
  }

  const retry = () => {
    cancel()
    failures = 0
    refreshedSession = false
    status.value = 'connecting'
    void poll()
  }

  watch(
    () => auth.value?.user?.id,
    () => {
      cancel()
      cursor = undefined
      failures = 0
      refreshedSession = false
      status.value = 'connecting'
      options.reset()
      schedule(10_000)
    },
    { immediate: true, flush: 'sync' },
  )
  watch(visibility, (value) => {
    if (value !== 'visible') cancel()
    else if (!blocked()) {
      const wait = status.value === 'retrying' ? nextPollAt - Date.now() : 0
      if (wait > 0) schedule(wait)
      else void poll()
    }
  })
  onScopeDispose(() => {
    disposed = true
    cancel()
  })

  return {
    status: computed<PollStatus>(() => (enabled() ? status.value : 'paused')),
    retry,
  }
}
