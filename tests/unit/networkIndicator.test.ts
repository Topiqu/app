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
