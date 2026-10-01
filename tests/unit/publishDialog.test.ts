// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { ShopifyPublication } from '../../shared/types/shopify'

import PublishDialog from '../../app/components/Article/Editor/PublishDialog.vue'

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const published: ShopifyPublication = {
  id: 'publication-1',
  status: 'SYNCED',
  shopifyArticleId: 'gid://shopify/Article/1',
  url: null,
  isPublished: true,
  lastSyncedAt: null,
  lastError: null,
}

const mount = (props: Partial<InstanceType<typeof PublishDialog>['$props']> = {}) =>
  mountSuspended(PublishDialog, {
    props: { open: true, topiquPublished: false, scheduled: false, blog: 'News', label: 'Publish', ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' } },
    },
  })
const confirm = async (wrapper: Awaited<ReturnType<typeof mount>>) => {
  await wrapper.find('[data-publish-confirm]').trigger('click')
  await flushPromises()
  return wrapper.emitted('confirm')?.at(-1)?.[0]
}

describe('editor publish dialog', () => {
  beforeEach(() => localStorage.clear())

  it('publishes to Topiqu and Shopify by default', async () => {
    expect(await confirm(await mount())).toEqual({ topiqu: true, shopify: 'published' })
  })

  it('sends a scheduled article to Shopify as a draft', async () => {
    expect(await confirm(await mount({ scheduled: true }))).toEqual({ topiqu: true, shopify: 'draft' })
  })

  it('keeps an existing Shopify draft a draft and warns about the overwrite', async () => {
    const wrapper = await mount({ topiquPublished: true, publication: { ...published, isPublished: false } })
    expect(wrapper.text()).toContain('common.shopify.replaceDescription')
    expect(await confirm(wrapper)).toEqual({ topiqu: true, shopify: 'draft' })
  })

  it('remembers leaving Shopify out for the next article', async () => {
    const wrapper = await mount()
    await wrapper.findAllComponents({ name: 'UCheckbox' })[1]!.vm.$emit('update:modelValue', false)
    expect(await confirm(wrapper)).toEqual({ topiqu: true, shopify: null })
    expect(await confirm(await mount())).toEqual({ topiqu: true, shopify: null })
  })
})
