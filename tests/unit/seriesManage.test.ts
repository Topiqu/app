// @vitest-environment nuxt

import { nextTick } from 'vue'
import { createError, getMethod, readBody } from 'h3'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import SeriesPage from '../../app/pages/admin/series.vue'
import SeriesEdit from '../../app/components/Series/Edit.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  invalidate: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  request: vi.fn(),
  fail: null as string | null,
}))
mockNuxtImport('useCacheInvalidation', () => () => ({ invalidateArticles: mocks.invalidate }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useFetch', () => () => ({
  data: shallowRef([{ id: 's1', name: 'Gugugaga', description: 'wiky', updatedAt: null, articles: [] }]),
  pending: shallowRef(false),
  error: shallowRef(null),
  refresh: mocks.refresh,
}))

const respond = async (event: Parameters<typeof getMethod>[0]) => {
  const method = getMethod(event)
  mocks.request(method, method === 'PATCH' ? await readBody(event) : undefined)
  if (mocks.fail) throw createError({ statusCode: 409, message: mocks.fail })
  return {}
}
// One registration per path: a second one for another method would replace the first.
registerEndpoint('/api/series/s1', respond)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fail = null
})

describe('series overview', () => {
  const button = async (icon: string) => {
    const wrapper = await mountSuspended(SeriesPage)
    return wrapper.findAllComponents({ name: 'UButton' }).find((item) => item.props('icon') === icon)!
  }

  it('deletes a series only after confirmation', async () => {
    const remove = await button('mdi:delete-outline')
    mocks.confirm.mockResolvedValue(false)
    remove.vm.$emit('click')
    await flushPromises()
    expect(mocks.request).not.toHaveBeenCalled()

    mocks.confirm.mockResolvedValue(true)
    remove.vm.$emit('click')
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('DELETE', undefined)
    await vi.waitFor(() => expect(mocks.invalidate).toHaveBeenCalled())
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('reports a failed delete and leaves the list alone', async () => {
    const remove = await button('mdi:delete-outline')
    mocks.confirm.mockResolvedValue(true)
    mocks.fail = 'nope'
    remove.vm.$emit('click')
    await flushPromises()
    await vi.waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ color: 'error' })))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('opens the editor with the chosen series', async () => {
    const wrapper = await mountSuspended(SeriesPage)
    wrapper
      .findAllComponents({ name: 'UButton' })
      .find((item) => item.props('icon') === 'mdi:pencil-outline')!
      .vm.$emit('click')
    await nextTick()
    const edit = wrapper.getComponent(SeriesEdit)
    expect(edit.props('open')).toBe(true)
    expect(edit.props('series')).toMatchObject({ id: 's1', name: 'Gugugaga' })
  })
})

describe('series edit form', () => {
  const series = { id: 's1', name: 'Gugugaga', description: 'wiky' }
  const mountForm = async () => {
    const wrapper = await mountSuspended(SeriesEdit, { props: { series, open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] form')).not.toBeNull())
    await flushPromises()
    return { wrapper, form: document.querySelector<HTMLFormElement>('[role="dialog"] form')! }
  }

  it('sends the edited name and clears an emptied description', async () => {
    const { wrapper, form } = await mountForm()
    const name = form.querySelector('input')!
    const description = form.querySelector('textarea')!
    expect(name.value).toBe('Gugugaga')
    expect(description.value).toBe('wiky')
    name.value = ' Stavební dokumenty '
    name.dispatchEvent(new Event('input'))
    description.value = '  '
    description.dispatchEvent(new Event('input'))
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(mocks.request).toHaveBeenCalledWith('PATCH', { name: 'Stavební dokumenty', description: null })
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
  })

  it('keeps the form open with an error when the name is taken', async () => {
    mocks.fail = 'Already exists'
    const { wrapper, form } = await mountForm()
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] [role="alert"]')).not.toBeNull())
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})
