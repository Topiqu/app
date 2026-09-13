import { createPinia } from 'pinia'
import { PiniaColada, useQuery } from '@pinia/colada'
import { defineComponent, h, ref, toValue } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../../app/utils/queryKeys'
import { useAuthorSummary } from '../../app/composables/useAuthorSummary'

afterEach(() => vi.unstubAllGlobals())

const request = vi.hoisted(() => vi.fn(async (url: string) => ({ username: url })))
mockNuxtImport('useRequestFetch', () => () => request)

describe('shared author queries', () => {
  it('loads lazily, deduplicates cards and switches data when the author changes', async () => {
    request.mockClear()
    vi.stubGlobal('useQuery', useQuery)
    vi.stubGlobal('queryKeys', queryKeys)
    vi.stubGlobal('toValue', toValue)
    const userId = ref('one')
    const queries: ReturnType<typeof useAuthorSummary>[] = []
    const Card = defineComponent({
      setup() {
        queries.push(useAuthorSummary(userId, false))
        return () => h('span')
      },
    })
    const wrapper = mount(defineComponent({ render: () => h('div', [h(Card), h(Card)]) }), {
      global: { plugins: [createPinia(), PiniaColada] },
    })
    try {
      expect(request).not.toHaveBeenCalled()
      await Promise.all(queries.map((query) => query.refresh(true)))
      expect(request).toHaveBeenCalledTimes(1)
      expect(queries[0]!.data.value).toEqual(queries[1]!.data.value)
      await queries[1]!.refresh()
      expect(request).toHaveBeenCalledTimes(1)
      userId.value = 'two'
      await flushPromises()
      expect(queries[0]!.data.value).toBeUndefined()
      await queries[0]!.refresh()
      expect(request).toHaveBeenCalledTimes(2)
      expect(queries[1]!.data.value?.username).toBe('/api/users/two/author')
    } finally {
      wrapper.unmount()
    }
  })
})
