import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NETWORK_RECOVERY_MS, useNetworkPill } from '../../app/composables/useNetworkPill'

const runPill = (online: boolean) => {
  const isOnline = ref(online)
  const scope = effectScope()
  const state = scope.run(() => useNetworkPill(isOnline))!
  return { isOnline, scope, ...state }
}

const drop = async (pill: ReturnType<typeof runPill>) => {
  pill.isOnline.value = false
  await nextTick()
}

const recover = async (pill: ReturnType<typeof runPill>) => {
  pill.isOnline.value = true
  await nextTick()
}

describe('network pill visibility', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stays visible for as long as the connection is down', async () => {
    const pill = runPill(true)
    expect(pill.visible.value).toBe(false)

    await drop(pill)
    expect(pill.visible.value).toBe(true)

    vi.advanceTimersByTime(NETWORK_RECOVERY_MS * 10)
    expect(pill.visible.value).toBe(true)
    pill.scope.stop()
  })

  it('dismisses itself once the connection is back', async () => {
    const pill = runPill(true)
    await drop(pill)
    await recover(pill)
    expect(pill.visible.value).toBe(true)

    vi.advanceTimersByTime(NETWORK_RECOVERY_MS)
    expect(pill.visible.value).toBe(false)
    pill.scope.stop()
  })

  it('does not let a pending recovery dismiss a fresh drop', async () => {
    const pill = runPill(true)
    await drop(pill)
    await recover(pill)

    vi.advanceTimersByTime(NETWORK_RECOVERY_MS - 500)
    await drop(pill)

    vi.advanceTimersByTime(NETWORK_RECOVERY_MS * 4)
    expect(pill.visible.value).toBe(true)
    pill.scope.stop()
  })

  it('never announces a recovery the user was not warned about', async () => {
    const pill = runPill(false)
    await recover(pill)

    vi.advanceTimersByTime(NETWORK_RECOVERY_MS)
    expect(pill.visible.value).toBe(false)
    pill.scope.stop()
  })

  it('shows the drop when a precached page boots offline', () => {
    const pill = runPill(false)
    pill.showIfOffline()
    expect(pill.visible.value).toBe(true)
    pill.scope.stop()
  })

  it('drops no pending timer when the consumer unmounts', async () => {
    const pill = runPill(true)
    await drop(pill)
    await recover(pill)

    pill.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('network indicator markup', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/components/Network/Indicator.vue'), 'utf8')

  it('announces connection changes through a live region that outlives the pill', () => {
    const liveRegion = source.indexOf('aria-live="polite"')
    expect(liveRegion).toBeGreaterThan(-1)
    expect(liveRegion).toBeLessThan(source.indexOf('v-if="visible"'))
    expect(source).toContain('role="status"')
  })

  it('leaves faster than it enters and carries the state change on a color transition', () => {
    expect(source).toContain('enterActiveClass="transition duration-200 ease-out"')
    expect(source).toContain('leaveActiveClass="transition duration-150 ease-in"')
    expect(source).toContain('transition-colors duration-300')
    expect(source).not.toContain('animate-pulse')
  })

  it('carries a solid surface so a dropped connection is not a whisper', () => {
    expect(source).toContain("isOnline ? 'bg-success' : 'bg-error'")
    expect(source).toContain('text-inverted')
    expect(source).toContain('text-sm font-medium')
  })

  it('signals the state without relying on color alone', () => {
    expect(source).toContain("isOnline ? 'mdi:wifi' : 'mdi:wifi-off'")
  })

  it('clears the bottom-right quota pill and the centred unsaved-changes bar', () => {
    expect(source).toContain('bottom-16')
    expect(source).toContain('pointer-events-none')
  })
})
