// @vitest-environment nuxt

import { nextTick } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { createError, getQuery, readBody } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import SeriesCreate from '../../app/components/Series/Create.vue'
import SeriesArticlePicker from '../../app/components/Series/ArticlePicker.vue'
import UPagination from '../../node_modules/@nuxt/ui/dist/runtime/components/Pagination.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), toast: vi.fn() }))
mockNuxtImport('useCacheInvalidation', () => () => ({ invalidateArticles: mocks.invalidate }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))

const article = (id: string, title: string) => ({
  id,
  title,
  imageUrl: null,
  language: 'cs',
  status: 'draft',
  releaseAt: null,
  scheduled: false,
})
const first = article('a', 'Český článek')
const second = article('b', 'Druhý díl')
const third = article('c', 'Článek na další stránce')
const queries: Record<string, unknown>[] = []
const writes: unknown[] = []
let fail = false
let release: (() => void) | undefined
registerEndpoint('/api/series/articles', (event) => {
  const query = getQuery(event)
  queries.push(query)
  return {
    data: query.query ? [third] : Number(query.page) === 2 ? [third] : [first, second],
    total: query.query ? 1 : 11,
  }
})
registerEndpoint('/api/series', {
  method: 'POST',
  handler: async (event) => {
    writes.push(await readBody(event))
    if (fail) throw createError({ statusCode: 409, message: 'series.articlesUnavailable' })
    await new Promise<void>((resolve) => {
      release = resolve
    })
    return { id: 'created', name: 'Nová série', articles: [] }
  },
})

beforeEach(() => {
  writes.length = 0
  queries.length = 0
  fail = false
  release = undefined
  vi.clearAllMocks()
  mocks.invalidate.mockResolvedValue(undefined)
})

const settle = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
const checkboxes = () => [...dialog().querySelectorAll<HTMLButtonElement>('[role="checkbox"]')]
const selectedTitles = () => [...dialog().querySelectorAll('ol li')].map((row) => row.textContent)
const input = (value: string) => {
  const field = dialog().querySelector<HTMLInputElement>('input[required]')!
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}
const submit = () =>
  dialog()
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
const mount = async () => {
  const wrapper = await mountSuspended(SeriesCreate, { props: { open: true }, attachTo: document.body })
  await vi.waitFor(() => expect(checkboxes()).toHaveLength(2))
  return wrapper
}

describe('series creation modal', () => {
  it('keeps selections through pagination and search, and submits the chosen order once', async () => {
    const wrapper = await mount()
    input('  Nová série  ')
    checkboxes()[0]!.click()
    await nextTick()
    checkboxes()[1]!.click()
    await settle()
    expect(selectedTitles()[0]).toContain(first.title)
    const picker = wrapper.getComponent(SeriesArticlePicker)
    picker.getComponent(UPagination).vm.$emit('update:page', 2)
    await vi.waitFor(() => expect(queries.at(-1)?.page).toBe('2'))
    await vi.waitFor(() => expect(checkboxes()).toHaveLength(1))
    expect(selectedTitles()).toHaveLength(2)
    const search = dialog().querySelector<HTMLInputElement>('input[maxlength="255"]:not([required])')!
    search.value = 'Článek'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.waitFor(() => expect(queries.at(-1)).toMatchObject({ query: 'Článek', page: '1' }))
    await vi.waitFor(() => expect(checkboxes()).toHaveLength(1))
    checkboxes()[0]!.click()
    await settle()
    expect(selectedTitles()).toHaveLength(3)
    dialog().querySelectorAll('ol li')[1]!.querySelector<HTMLButtonElement>('button')!.click()
    await settle()
    expect(selectedTitles()[0]).toContain(second.title)
    submit()
    submit()
    await vi.waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ name: 'Nová série', description: '', articleIds: ['b', 'a', 'c'] })
    expect(dialog().querySelector('input[required]')?.hasAttribute('disabled')).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    release!()
    await vi.waitFor(() => expect(wrapper.emitted('created')).toHaveLength(1))
    expect(wrapper.emitted('update:open')).toContainEqual([false])
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it('preserves form and selection after failure, supports removal, and resets on reopen', async () => {
    fail = true
    const wrapper = await mount()
    input('Rozpracovaná série')
    checkboxes()[0]!.click()
    await settle()
    submit()
    await vi.waitFor(() => expect(dialog().querySelector('[role="alert"]')).not.toBeNull())
    expect(dialog().querySelector<HTMLInputElement>('input[required]')!.value).toBe('Rozpracovaná série')
    expect(selectedTitles()).toHaveLength(1)
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(mocks.invalidate).not.toHaveBeenCalled()
    dialog().querySelector('ol li')!.querySelectorAll<HTMLButtonElement>('button')[2]!.click()
    await settle()
    expect(selectedTitles()).toHaveLength(0)
    await wrapper.setProps({ open: false })
    await settle()
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(dialog().querySelector<HTMLInputElement>('input[required]')!.value).toBe(''))
    await vi.waitFor(() => expect(checkboxes()).toHaveLength(2))
    expect(dialog().querySelector('[role="alert"]')).toBeNull()
  })

  it('requires a nonblank name and allows creating an empty series', async () => {
    const wrapper = await mount()
    input('   ')
    submit()
    await settle()
    expect(writes).toHaveLength(0)
    input('Prázdná série')
    submit()
    await vi.waitFor(() => expect(writes).toEqual([{ name: 'Prázdná série', description: '', articleIds: [] }]))
    release!()
    await vi.waitFor(() => expect(wrapper.emitted('created')).toHaveLength(1))
  })
})
