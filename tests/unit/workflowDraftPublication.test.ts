// @vitest-environment nuxt

import { defineComponent, h, ref, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Drafts from '../../app/pages/drafts.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn(), confirm: vi.fn(), refresh: vi.fn() }))
const draft = (status = 'DRAFT', publicationUrn: string | null = null) => ({
  id: 'draft-a',
  status,
  publicationUrn,
  publicationAttemptedAt: null,
  publicationError: null,
  text: 'Draft text',
  score: 90,
  policyFlags: [],
  task: { topic: 'Topic', company: { name: 'Company' } },
})
const draftPage = ref({ drafts: [draft()], total: 1 })
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useAuth', () => () => ({ data: shallowRef({ user: { clientSiteId: 'tenant-a' } }) }))
mockNuxtImport('useTenantScope', () => () => () => true)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useLazyFetch', () => async () => ({
  data: draftPage,
  pending: shallowRef(false),
  error: shallowRef(null),
  refresh: mocks.refresh,
}))
mockNuxtImport('useOptimisticStatus', () => () => ({ saving: vi.fn(), saved: vi.fn(), reverted: vi.fn() }))

const Modal = defineComponent({
  props: ['open'],
  setup:
    (props, { slots }) =>
    () =>
      props.open ? h('div', [slots.body?.(), slots.footer?.()]) : null,
})
const mountDrafts = () =>
  mountSuspended(Drafts, {
    shallow: true,
    global: { renderStubDefaultSlot: true, mocks: { $t: (key: string) => key }, stubs: { UModal: Modal } },
  })
type DraftWrapper = Awaited<ReturnType<typeof mountDrafts>>
const button = (wrapper: DraftWrapper, key: string) =>
  wrapper.findAllComponents({ name: 'UButton' }).find((item) => item.text() === `articles.workflowDrafts.${key}`)!
const publish = async (wrapper: DraftWrapper) => {
  button(wrapper, 'publish').vm.$emit('click')
  await flushPromises()
}
const deferred = () => {
  let resolve!: (value: unknown) => void
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.confirm.mockResolvedValue(true)
  mocks.fetch.mockResolvedValue({ status: 'published' })
  mocks.refresh.mockResolvedValue(undefined)
  draftPage.value = { drafts: [draft()], total: 1 }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('LinkedIn workflow publication outcomes', () => {
  it('coalesces approval clicks and keeps the authoritative server status', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = await mountDrafts()
    const approve = button(wrapper, 'approve')
    approve.vm.$emit('click')
    approve.vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/drafts/draft-a/approve', { method: 'POST' })
    expect(draftPage.value.drafts[0]?.status).toBe('APPROVED')
    pending.resolve({ draft: { status: 'AWAITING_APPROVAL' } })
    await flushPromises()
    expect(draftPage.value.drafts[0]?.status).toBe('AWAITING_APPROVAL')
    expect(button(wrapper, 'approve').props('disabled')).toBe(false)
  })

  it('restores a rejected draft and its reason after failure, then allows a retry', async () => {
    const wrapper = await mountDrafts()
    button(wrapper, 'reject').vm.$emit('click')
    await flushPromises()
    wrapper.findComponent({ name: 'UTextarea' }).vm.$emit('update:modelValue', '  Needs another review  ')
    await flushPromises()
    const submit = () =>
      wrapper
        .findAllComponents({ name: 'UButton' })
        .filter((item) => item.text() === 'articles.workflowDrafts.reject')
        .at(-1)!
    mocks.fetch.mockRejectedValueOnce(new Error('Temporary failure'))
    submit().vm.$emit('click')
    await flushPromises()
    expect(draftPage.value.drafts[0]?.status).toBe('DRAFT')
    expect(wrapper.findComponent({ name: 'UTextarea' }).props('modelValue')).toBe('Needs another review')
    expect(mocks.toast).toHaveBeenCalledWith({ color: 'error', title: 'articles.workflowDrafts.rejectionFailed' })
    mocks.fetch.mockResolvedValueOnce({ draft: { status: 'REJECTED' } })
    submit().vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenLastCalledWith('/api/drafts/draft-a/reject', {
      method: 'POST',
      body: { reason: 'Needs another review' },
    })
    expect(draftPage.value.drafts[0]?.status).toBe('REJECTED')
  })

  it.each([
    ['published', 'success', 'publishSuccess', 'PUBLISHED'],
    ['awaiting_approval', 'info', 'publicationAwaitingApproval', 'AWAITING_APPROVAL'],
    ['skipped', 'info', 'publicationSkipped', 'PUBLISHING'],
    ['needs_review', 'warning', 'publicationNeedsReview', 'PUBLISHING'],
  ])('shows the actual %s outcome without a false success', async (status, color, key, localStatus) => {
    mocks.fetch.mockResolvedValueOnce({ status })
    const wrapper = await mountDrafts()
    await publish(wrapper)
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({ color, title: `articles.workflowDrafts.${key}` })
    expect(draftPage.value.drafts[0]?.status).toBe(localStatus)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('does not convert confirmed publication into a failed result when refresh fails', async () => {
    mocks.refresh.mockRejectedValueOnce(new Error('Read unavailable'))
    const wrapper = await mountDrafts()
    await publish(wrapper)
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
      color: 'success',
      title: 'articles.workflowDrafts.publishSuccess',
    })
    expect(draftPage.value.drafts[0]?.status).toBe('PUBLISHED')
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('keeps an uncertain failed request locked until an authoritative refresh instead of allowing another publish', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Connection lost'))
    mocks.refresh.mockRejectedValueOnce(new Error('Read unavailable'))
    const wrapper = await mountDrafts()
    await publish(wrapper)
    expect(draftPage.value.drafts[0]?.status).toBe('PUBLISHING')
    expect(button(wrapper, 'publish')).toBeUndefined()
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ color: 'warning', description: 'articles.workflowDrafts.publicationUnconfirmed' }),
    )
  })

  it('coalesces concurrent confirmation completions into one publish request', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = await mountDrafts()
    const trigger = button(wrapper, 'publish')
    trigger.vm.$emit('click')
    trigger.vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    pending.resolve({ status: 'published' })
    await flushPromises()
  })

  it('locally reconciles a confirmed URN without calling the publishing endpoint', async () => {
    draftPage.value.drafts = [draft('PUBLISHING', 'urn:li:share:123')]
    const wrapper = await mountDrafts()
    button(wrapper, 'finishPublicationRecord').vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/publish/draft-a/reconcile', { method: 'POST', body: {} })
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({
      color: 'success',
      title: 'articles.workflowDrafts.publicationReconciled',
    })
  })

  it('requires an explicit remote-post confirmation and valid ID before manual reconciliation', async () => {
    draftPage.value.drafts = [draft('PUBLISHING')]
    const wrapper = await mountDrafts()
    button(wrapper, 'verifyPublication').vm.$emit('click')
    await flushPromises()
    expect(button(wrapper, 'finishPublicationRecord').props('disabled')).toBe(true)
    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'urn:li:share:123')
    await flushPromises()
    button(wrapper, 'finishPublicationRecord').vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    wrapper.findComponent({ name: 'UCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(button(wrapper, 'finishPublicationRecord').props('disabled')).toBe(false)
    button(wrapper, 'finishPublicationRecord').vm.$emit('click')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/publish/draft-a/reconcile', {
      method: 'POST',
      body: { linkedinPostId: 'urn:li:share:123', confirmedPublished: true },
    })
  })

  it('preserves manual confirmation fields when reconciliation fails', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Attempt still in progress'))
    draftPage.value.drafts = [draft('PUBLISHING')]
    const wrapper = await mountDrafts()
    button(wrapper, 'verifyPublication').vm.$emit('click')
    await flushPromises()
    wrapper.findComponent({ name: 'UInput' }).vm.$emit('update:modelValue', 'urn:li:ugcPost:123')
    wrapper.findComponent({ name: 'UCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    button(wrapper, 'finishPublicationRecord').vm.$emit('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'UInput' }).props('modelValue')).toBe('urn:li:ugcPost:123')
    expect(wrapper.findComponent({ name: 'UCheckbox' }).props('modelValue')).toBe(true)
    expect(mocks.toast).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ color: 'error' }))
    expect(draftPage.value.drafts[0]?.status).toBe('PUBLISHING')
  })

  it('ignores stale publication UI effects after the page unmounts', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = await mountDrafts()
    await publish(wrapper)
    wrapper.unmount()
    pending.resolve({ status: 'published' })
    await flushPromises()
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
