// @vitest-environment nuxt

import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import { queryKeys } from '../../app/utils/queryKeys'
import { useCacheInvalidation } from '../../app/composables/useCacheInvalidation'

const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), status: vi.fn(), site: vi.fn() }))
mockNuxtImport('useQueryCache', () => () => ({ invalidateQueries: mocks.invalidate }))
mockNuxtImport('refreshClientSiteStatus', () => mocks.status)
mockNuxtImport('refreshClientSite', () => mocks.site)

describe('feature cache invalidation', () => {
  it('refreshes shared capabilities, publication data, visibility and feature-dependent stats', async () => {
    await useCacheInvalidation().invalidateClientFeatures()
    expect(mocks.status).toHaveBeenCalledOnce()
    expect(mocks.site).toHaveBeenCalledOnce()
    expect(mocks.invalidate.mock.calls.map(([options]) => options.key)).toEqual([
      queryKeys.clients.all,
      queryKeys.visibility.all,
      queryKeys.stats.all,
    ])
  })
})
