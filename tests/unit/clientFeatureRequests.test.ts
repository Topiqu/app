// @vitest-environment nuxt

import { effectScope, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSite } from '../../app/utils/buildClientSettingsForm'

import { useClientFeatures } from '../../app/composables/useClientFeatures'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  fetch: vi.fn(),
  refresh: vi.fn(),
  invalidate: vi.fn(),
  toast: vi.fn(),
}))
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useI18n', () => () => ({
  t: (key: string, values?: unknown) => `${key}${values ? JSON.stringify(values) : ''}`,
}))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useCacheInvalidation', () => () => ({ invalidateClientFeatures: mocks.invalidate }))

const scopes: ReturnType<typeof effectScope>[] = []
const setup = (activeFeatures: string[] = []) => {
  const client = shallowRef({
    id: 'tenant-1',
    plan: 'CUSTOM',
    activeFeatures,
    monthlyPayment: 0,
    annualPayment: 0,
  } as ClientSite)
  const scope = effectScope()
  scopes.push(scope)
  return { client, scope, ...scope.run(() => useClientFeatures(client, mocks.refresh))! }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.confirm.mockResolvedValue(true)
  mocks.fetch.mockResolvedValue({ activeFeatures: ['AI'], monthlyPayment: 10, annualPayment: 96 })
  mocks.refresh.mockResolvedValue(undefined)
  mocks.invalidate.mockResolvedValue(undefined)
})
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('feature confirmation and mutation', () => {
  it.each(['AI', 'SENTIMENT', 'ARTICLE_CRONS'] as const)(
    'cancels enabling and disabling %s without a request',
    async (code) => {
      mocks.confirm.mockResolvedValue(false)
      for (const enabled of [true, false]) {
        const state = setup(enabled ? [] : [code])
        await state.toggle({ code, enabled })
        expect(state.client.value.activeFeatures).toEqual(enabled ? [] : [code])
        expect(state.pending.value).toBe(false)
      }
      expect(mocks.confirm).toHaveBeenCalledTimes(2)
      expect(mocks.fetch).not.toHaveBeenCalled()
      expect(mocks.invalidate).not.toHaveBeenCalled()
    },
  )

  it('waits for confirmation, blocks duplicate toggles and applies only the server response', async () => {
    let answer!: (value: boolean) => void
    mocks.confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const state = setup()
    const saving = state.toggle({ code: 'AI', enabled: true })
    expect(state.pending.value).toBe(true)
    expect(mocks.fetch).not.toHaveBeenCalled()
    await state.toggle({ code: 'AI', enabled: true })
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    answer(true)
    await saving
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/clients/tenant-1/features', {
      method: 'PATCH',
      body: { code: 'AI', enabled: true },
    })
    expect(state.client.value).toMatchObject({ activeFeatures: ['AI'], monthlyPayment: 10 })
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(state.pending.value).toBe(false)
  })

  it('explains dependent deactivation and uses the supplied catalog price and billing period', async () => {
    const state = setup(['AI', 'SENTIMENT', 'ARTICLE_CRONS'])
    await state.toggle({ code: 'AI', enabled: false, price: '€12/month', minimumBillingDays: 45 })
    const options = mocks.confirm.mock.calls[0]![0]
    expect(options.variant).toBe('danger')
    expect(options.message).toContain('common.features.disableAiMessage')
    expect(options.message).toContain('€12/month')
    expect(options.message).toContain('"days":45')
  })

  it('keeps the previous state and permits retry when persistence fails', async () => {
    const state = setup()
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    await state.toggle({ code: 'AI', enabled: true })
    expect(state.client.value.activeFeatures).toEqual([])
    expect(state.pending.value).toBe(false)
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' }))
    await state.toggle({ code: 'AI', enabled: true })
    expect(state.client.value.activeFeatures).toEqual(['AI'])
  })

  it('retains a saved feature and reports a refresh failure separately', async () => {
    const state = setup()
    mocks.invalidate.mockRejectedValueOnce(new Error('Refresh unavailable'))
    await state.toggle({ code: 'AI', enabled: true })
    expect(state.client.value.activeFeatures).toEqual(['AI'])
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'warning', description: 'common.features.refreshFailed' }),
    )
  })

  it('invalidates shared data after a completed request even when settings has unmounted', async () => {
    let commit!: (value: { activeFeatures: string[]; monthlyPayment: number; annualPayment: number }) => void
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          commit = resolve
        }),
    )
    const state = setup()
    const saving = state.toggle({ code: 'AI', enabled: true })
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())
    state.scope.stop()
    commit({ activeFeatures: ['AI'], monthlyPayment: 10, annualPayment: 96 })
    await saving
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it.each(['tenant', 'features', 'plan'] as const)('rejects a confirmation after %s changes', async (change) => {
    let answer!: (value: boolean) => void
    mocks.confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const state = setup()
    const saving = state.toggle({ code: 'AI', enabled: true })
    state.client.value = {
      ...state.client.value,
      ...(change === 'tenant'
        ? { id: 'other' }
        : change === 'features'
          ? { activeFeatures: ['AI'] }
          : { plan: 'BASIC' }),
    }
    answer(true)
    await saving
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
