// @vitest-environment nuxt

import { shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveClientSite } from '../../app/composables/useClientSite'

const { useAsyncData } = vi.hoisted(() => ({ useAsyncData: vi.fn() }))
mockNuxtImport('useAsyncData', () => useAsyncData)
mockNuxtImport('useRequestURL', () => () => new URL('https://footer.example'))
mockNuxtImport('useRoute', () => () => ({ query: {} }))

type CacheOptions = {
  getCachedData: (
    key: string,
    app: { payload: { data: Record<string, unknown> }; static: { data: Record<string, unknown> } },
    context: { cause: string },
  ) => unknown
}

beforeEach(() => {
  useAsyncData.mockReset().mockReturnValue({ data: shallowRef(null) })
})

describe('tenant site cache', () => {
  const cachePolicy = async () => {
    await useLiveClientSite()
    const [key, , options] = useAsyncData.mock.calls[0] as [string, unknown, CacheOptions]
    return { key, getCachedData: options.getCachedData }
  }

  it.each(['refresh:manual', 'refresh:hook'])('fetches fresh site settings for %s', async (cause) => {
    const { key, getCachedData } = await cachePolicy()
    const stale = { footerSettings: { text: 'Previous footer' } }
    expect(
      getCachedData(key, { payload: { data: { [key]: stale } }, static: { data: { [key]: stale } } }, { cause }),
    ).toBeUndefined()
  })

  it('reuses the server payload for initial rendering', async () => {
    const { key, getCachedData } = await cachePolicy()
    const initial = { footerSettings: { text: 'Saved footer' } }
    expect(
      getCachedData(key, { payload: { data: { [key]: initial } }, static: { data: {} } }, { cause: 'initial' }),
    ).toBe(initial)
  })

  it('can reuse static data when there is no server payload', async () => {
    const { key, getCachedData } = await cachePolicy()
    const initial = { footerSettings: { text: 'Saved footer' } }
    expect(
      getCachedData(key, { payload: { data: {} }, static: { data: { [key]: initial } } }, { cause: 'initial' }),
    ).toBe(initial)
  })
})
