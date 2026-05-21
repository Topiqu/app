import type { EventStream } from 'h3'

const REPLAY_BUFFER_SIZE = 50
const HEARTBEAT_INTERVAL_MS = 25_000
const STALE_CHANNEL_GC_MS = 60_000

export interface RealtimeMessage<T = unknown> {
  id: string
  channel: string
  event: string
  data: T
  ts: number
}

interface Subscriber {
  id: string
  stream: EventStream
  channel: string
  connectedAt: number
}

interface ChannelState {
  subscribers: Map<string, Subscriber>
  buffer: RealtimeMessage[]
}

interface RealtimeRegistry {
  channels: Map<string, ChannelState>
  heartbeatTimer?: ReturnType<typeof setInterval>
  totalConnects: number
  totalMessages: number
}

declare global {
  // eslint-disable-next-line no-var
  var __realtimeRegistry: RealtimeRegistry | undefined
}

const registry: RealtimeRegistry =
  globalThis.__realtimeRegistry ?? {
    channels: new Map(),
    totalConnects: 0,
    totalMessages: 0,
  }
globalThis.__realtimeRegistry = registry

const log = (level: 'info' | 'warn' | 'error', msg: string, extra?: Record<string, unknown>) => {
  const prefix = `[realtime]`
  const payload = extra ? ` ${JSON.stringify(extra)}` : ''
  // eslint-disable-next-line no-console
  console[level](`${prefix} ${msg}${payload}`)
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const ensureChannel = (channel: string): ChannelState => {
  let state = registry.channels.get(channel)
  if (!state) {
    state = { subscribers: new Map(), buffer: [] }
    registry.channels.set(channel, state)
  }
  return state
}

const startHeartbeat = () => {
  if (registry.heartbeatTimer) return
  registry.heartbeatTimer = setInterval(() => {
    const now = Date.now()
    for (const [channel, state] of registry.channels) {
      const stale: string[] = []
      for (const sub of state.subscribers.values()) {
        sub.stream
          .push({ event: '__ping', data: String(now) })
          .catch((e) => {
            stale.push(sub.id)
            log('warn', `heartbeat failed, removing subscriber`, { channel, id: sub.id, err: e?.message })
          })
      }
      stale.forEach((id) => state.subscribers.delete(id))
      if (state.subscribers.size === 0 && now - (state.buffer.at(-1)?.ts ?? now) > STALE_CHANNEL_GC_MS) {
        registry.channels.delete(channel)
      }
    }
  }, HEARTBEAT_INTERVAL_MS)
}

const stopHeartbeatIfIdle = () => {
  if (!registry.heartbeatTimer) return
  let count = 0
  for (const s of registry.channels.values()) count += s.subscribers.size
  if (count === 0) {
    clearInterval(registry.heartbeatTimer)
    registry.heartbeatTimer = undefined
  }
}

export const realtime = {
  subscribe(channel: string, stream: EventStream): { id: string; unsubscribe: () => void } {
    const state = ensureChannel(channel)
    const id = newId()
    state.subscribers.set(id, { id, stream, channel, connectedAt: Date.now() })
    registry.totalConnects++
    startHeartbeat()
    log('info', `connect`, { channel, id, total: state.subscribers.size })

    return {
      id,
      unsubscribe: () => {
        state.subscribers.delete(id)
        log('info', `disconnect`, { channel, id, remaining: state.subscribers.size })
        stopHeartbeatIfIdle()
      },
    }
  },

  async publish<T>(channel: string, event: string, data: T): Promise<RealtimeMessage<T>> {
    const state = ensureChannel(channel)
    const msg: RealtimeMessage<T> = {
      id: newId(),
      channel,
      event,
      data,
      ts: Date.now(),
    }

    state.buffer.push(msg as RealtimeMessage)
    if (state.buffer.length > REPLAY_BUFFER_SIZE) state.buffer.shift()

    const serialized = { id: msg.id, event, data: JSON.stringify(data) }
    const dead: string[] = []
    await Promise.all(
      [...state.subscribers.values()].map((sub) =>
        sub.stream
          .push(serialized)
          .catch((e) => {
            dead.push(sub.id)
            log('warn', `push failed, dropping subscriber`, { channel, id: sub.id, err: e?.message })
          }),
      ),
    )
    dead.forEach((id) => state.subscribers.delete(id))
    registry.totalMessages++
    return msg
  },

  async broadcast<T>(channels: string[], event: string, data: T) {
    await Promise.all(channels.map((c) => this.publish(c, event, data)))
  },

  replay(channel: string, sinceId: string | undefined): RealtimeMessage[] {
    if (!sinceId) return []
    const state = registry.channels.get(channel)
    if (!state) return []
    const idx = state.buffer.findIndex((m) => m.id === sinceId)
    return idx === -1 ? [] : state.buffer.slice(idx + 1)
  },

  stats() {
    const channels: Record<string, { subscribers: number; bufferedMessages: number; oldestSubscriberAgeMs: number | null }> = {}
    for (const [name, state] of registry.channels) {
      const oldest = [...state.subscribers.values()].reduce<number | null>(
        (acc, s) => (acc === null || s.connectedAt < acc ? s.connectedAt : acc),
        null,
      )
      channels[name] = {
        subscribers: state.subscribers.size,
        bufferedMessages: state.buffer.length,
        oldestSubscriberAgeMs: oldest ? Date.now() - oldest : null,
      }
    }
    return {
      channels,
      totalConnects: registry.totalConnects,
      totalMessages: registry.totalMessages,
      heartbeatActive: !!registry.heartbeatTimer,
    }
  },
}

export type Realtime = typeof realtime
