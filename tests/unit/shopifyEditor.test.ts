// @vitest-environment nuxt
import { shallowRef } from 'vue'
import { createError, readBody } from 'h3'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import type { ShopifyStatus } from '../../shared/types/shopify'

import ShopifyEditor from '../../app/components/Article/Editor/Shopify.vue'

enableAutoUnmount(afterEach)
const mocks = vi.hoisted(() => ({
  status: { value: null as ShopifyStatus | null },
  confirm: vi.fn(),
  refresh: vi.fn(),
  fetch: vi.fn(),
  toast: vi.fn(),
}))
mockNuxtImport('useShopify', () => async () => ({ data: mocks.status, refresh: mocks.refresh }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useLocalePath', () => () => () => '/en/settings')
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))

registerEndpoint('/api/articles/article-1/shopify', {
  method: 'GET',
  handler: () => mocks.fetch('/api/articles/article-1/shopify'),
})
registerEndpoint('/api/articles/article-1/shopify', {
  method: 'POST',
  handler: async (event) => {
    try {
      return await mocks.fetch('/api/articles/article-1/shopify', { method: 'POST', body: await readBody(event) })
    } catch (error) {
      throw createError({ statusCode: 409, data: (error as { data: { data: unknown } }).data.data })
    }
  },
})

const publication = {
  id: 'publication-1',
  status: 'SYNCED',
  shopifyArticleId: 'gid://shopify/Article/1',
  url: 'https://store.example/blogs/news/article',
  isPublished: true,
  lastSyncedAt: null,
  lastError: null,
}

const button = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, key: string) =>
  wrapper.findAll('button').find((button) => button.text().includes(key))!
const mount = async (disabled = false) => {
  const wrapper = await mountSuspended(ShopifyEditor, {
    props: { articleId: 'article-1', disabled },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
        UIcon: true,
        NuxtTime: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Shopify publishing in the editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.status = shallowRef({
      configured: true,
      eligible: true,
      canManage: true,
      canPublish: true,
      connection: {
        shop: 'store.myshopify.com',
        shopName: 'Store',
        blogId: 'gid://shopify/Blog/1',
        blogTitle: 'News',
        author: 'Topiqu',
        status: 'CONNECTED',
      },
    })
    mocks.confirm.mockResolvedValue(true)
    mocks.fetch.mockImplementation(async (_url, options) => (options?.method === 'POST' ? publication : null))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('blocks sending unsaved changes', async () => {
    const wrapper = await mount(true)
    expect(button(wrapper, 'common.shopify.sendDraft').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('common.shopify.saveFirst')
    expect(mocks.fetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false)
  })

  it('sends the saved article as a Shopify draft', async () => {
    const wrapper = await mount()
    await button(wrapper, 'common.shopify.sendDraft').trigger('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/articles/article-1/shopify', {
      method: 'POST',
      body: { mode: 'draft' },
    })
  })

  it('requires confirmation before replacing a Shopify article and respects cancellation', async () => {
    mocks.fetch.mockImplementation(async () => publication)
    mocks.confirm.mockResolvedValue(false)
    const wrapper = await mount()
    await button(wrapper, 'common.shopify.update').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledWith({
      title: 'common.shopify.update',
      message: 'common.shopify.replaceDescription',
    })
    expect(mocks.fetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false)
  })

  it('explains that sending a published article as a draft hides it in the store', async () => {
    mocks.fetch.mockImplementation(async () => publication)
    mocks.confirm.mockResolvedValue(false)
    const wrapper = await mount()
    await button(wrapper, 'common.shopify.sendDraft').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledWith({
      title: 'common.shopify.update',
      message: 'common.shopify.unpublishDescription',
    })
  })

  it('keeps the panel hidden when publishing is not permitted', async () => {
    mocks.status.value!.canPublish = false
    const wrapper = await mount()
    expect(wrapper.find('[data-shopify-publication]').exists()).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('requires a media-rights acknowledgement before sending again', async () => {
    mocks.fetch.mockImplementation(async (_url, options) => {
      if (options?.method !== 'POST') return null
      if (options.body.mediaRightsReview) return publication
      throw {
        data: {
          data: {
            code: 'MEDIA_RIGHTS_REVIEW_REQUIRED',
            report: { fingerprint: 'review-1', counts: { needsAttention: 1 }, items: [] },
          },
        },
      }
    })
    const wrapper = await mount()
    await button(wrapper, 'common.shopify.publish').trigger('click')
    await flushPromises()
    await button(wrapper, 'common.shopify.confirmSend').trigger('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenLastCalledWith('/api/articles/article-1/shopify', {
      method: 'POST',
      body: { mode: 'published', mediaRightsReview: { fingerprint: 'review-1', acknowledged: true } },
    })
  })
})
