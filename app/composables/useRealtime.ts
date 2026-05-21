import type { MaybeRefOrGetter, ShallowRef } from 'vue'

export interface UseRealtimeOptions<H extends Record<string, (data: any) => void>> {
  handlers: H
  enabled?: MaybeRefOrGetter<boolean>
  staleAfterMs?: number
  onStale?: () => void
  debug?: boolean
}

export interface UseRealtimeReturn {
  status: ShallowRef<'CONNECTING' | 'OPEN' | 'CLOSED'>
  lastEventId: ShallowRef<string | null>
  lastHeartbeatAt: ShallowRef<number | null>
  isStale: ShallowRef<boolean>
  error: ShallowRef<Event | null>
  reconnectAttempts: ShallowRef<number>
  close: () => void
  reopen: () => void
}

export const useRealtime = <H extends Record<string, (data: any) => void>>(
  url: MaybeRefOrGetter<string | undefined>,
  options: UseRealtimeOptions<H>,
): UseRealtimeReturn => {
  const { handlers, enabled = true, staleAfterMs = 60_000, onStale, debug = false } = options
  const eventNames = Object.keys(handlers)

  const lastHeartbeatAt = shallowRef<number | null>(null)
  const isStale = shallowRef(false)
  const reconnectAttempts = shallowRef(0)

  const dlog = (...args: unknown[]) => {
    if (debug || (typeof window !== 'undefined' && (window as any).__realtimeDebug)) {
      // eslint-disable-next-line no-console
      console.debug('[realtime:client]', ...args)
    }
  }

  const targetUrl = computed(() => (toValue(enabled) ? toValue(url) : undefined))

  const { status, error, eventSource, lastEventId, close, open } = useEventSource(targetUrl, [], {
    autoReconnect: {
      retries: -1,
      delay: 1500,
      onFailed: () => dlog('autoReconnect failed permanently'),
    },
  })

  watch(status, (s, prev) => {
    dlog(`status ${prev} → ${s}`)
    if (s === 'OPEN') {
      reconnectAttempts.value = 0
      // Grace period: server may not have sent __ping yet. Reset clock so watchdog
      // doesn't immediately re-stale us into a reconnect loop.
      lastHeartbeatAt.value = Date.now()
      isStale.value = false
    }
    if (s === 'CONNECTING' && prev === 'CLOSED') reconnectAttempts.value++
  })

  watch(error, (e) => {
    if (e) dlog('error event', e)
  })

  watch(eventSource, (es, prev) => {
    if (prev) {
      prev.removeEventListener('__ping', onPing as EventListener)
      prev.removeEventListener('__ready', onReady as EventListener)
      for (const name of eventNames) prev.removeEventListener(name, dispatchers[name] as EventListener)
    }
    if (!es) return

    es.addEventListener('__ping', onPing as EventListener)
    es.addEventListener('__ready', onReady as EventListener)
    for (const name of eventNames) {
      es.addEventListener(name, dispatchers[name] as EventListener)
    }
  })

  const onPing = (e: MessageEvent) => {
    lastHeartbeatAt.value = Date.now()
    isStale.value = false
    dlog('ping', e.data)
  }

  const onReady = (e: MessageEvent) => {
    lastHeartbeatAt.value = Date.now()
    isStale.value = false
    dlog('ready', e.data)
  }

  const dispatchers: Record<string, (e: MessageEvent) => void> = {}
  for (const name of eventNames) {
    dispatchers[name] = (e: MessageEvent) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(e.data)
      } catch (err) {
        dlog(`failed to parse event "${name}"`, err, e.data)
        return
      }
      try {
        handlers[name]!(parsed)
      } catch (err) {
        dlog(`handler for "${name}" threw`, err)
      }
    }
  }

  if (import.meta.client) {
    useIntervalFn(
      () => {
        if (status.value !== 'OPEN') return
        if (!lastHeartbeatAt.value) return
        const age = Date.now() - lastHeartbeatAt.value
        if (age > staleAfterMs && !isStale.value) {
          isStale.value = true
          dlog(`stale: no heartbeat for ${age}ms — forcing reconnect`)
          onStale?.()
          close()
          open()
        }
      },
      10_000,
      { immediateCallback: false },
    )
  }

  onScopeDispose(() => {
    close()
  })

  return {
    status,
    lastEventId,
    lastHeartbeatAt,
    isStale,
    error,
    reconnectAttempts,
    close,
    reopen: open,
  }
}
