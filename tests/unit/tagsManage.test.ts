// @vitest-environment nuxt

import { readBody } from 'h3'
import { nextTick } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import TagsCreate from '../../app/components/Tags/Create.vue'

enableAutoUnmount(afterEach)

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

registerEndpoint('/api/tags', () => [
  { id: 'a', name: 'Xbox' },
  { id: 'b', name: 'PlayStation' },
])
const writes: { method: string; body: { name: string; slug: string } }[] = []
registerEndpoint('/api/tags', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody<{ name: string; slug: string }>(event)
    writes.push({ method: 'POST', body })
    return { id: 'created', name: body.name }
  },
})
registerEndpoint('/api/tags/a', {
  method: 'PATCH',
  handler: async (event) => {
    const body = await readBody<{ name: string; slug: string }>(event)
    writes.push({ method: 'PATCH', body })
    return { tag: { id: 'a', name: body.name } }
  },
})
beforeEach(() => {
  writes.length = 0
})

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const mount = async () => {
  const wrapper = await mountSuspended(TagsCreate, { props: { modelValue: false }, attachTo: document.body })
  await wrapper.setProps({ modelValue: true })
  await settle()
  return wrapper
}

const chip = (id: string) => document.querySelector<HTMLElement>(`[data-tag-id="${id}"]`)!
const searchInput = () => document.querySelector<HTMLInputElement>('form input')!
const addButton = () => document.querySelector<HTMLButtonElement>('form button[type="submit"]')!

describe('Tags/Create', () => {
  it('loads tags when lazy-mounted directly in the open state', async () => {
    await mountSuspended(TagsCreate, { props: { modelValue: true }, attachTo: document.body })
    await settle()
    expect(chip('a')?.textContent).toContain('Xbox')
    expect(chip('b')?.textContent).toContain('PlayStation')
  })

  it('turns a tag name into an input when clicked', async () => {
    await mount()

    chip('a').querySelector('button')!.click()
    await settle()

    expect(chip('a').querySelector<HTMLInputElement>('input')?.value).toBe('Xbox')
  })

  it('filters with the same field that adds, and refuses an existing name', async () => {
    await mount()
    const input = searchInput()

    input.value = 'xbox'
    input.dispatchEvent(new Event('input'))
    await settle()
    expect(document.querySelectorAll('[data-tag-id]')).toHaveLength(1)
    expect(addButton().disabled).toBe(true)

    input.value = 'Nintendo'
    input.dispatchEvent(new Event('input'))
    await settle()
    expect(document.querySelectorAll('[data-tag-id]')).toHaveLength(0)
    expect(addButton().disabled).toBe(false)
  })

  it('cancels a rename on Escape without closing the modal', async () => {
    const wrapper = await mount()

    chip('a').querySelector('button')!.click()
    await settle()
    chip('a')
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()

    expect(chip('a').querySelector('input')).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('creates a Czech tag with its original name and normalized public slug', async () => {
    await mount()
    const input = searchInput()
    input.value = '  Příliš žluťoučký kůň  '
    input.dispatchEvent(new Event('input'))
    await settle()
    addButton().click()
    await settle()
    expect(writes).toEqual([{ method: 'POST', body: { name: 'Příliš žluťoučký kůň', slug: 'prilis-zlutoucky-kun' } }])
    expect(chip('created').textContent).toContain('Příliš žluťoučký kůň')
  })

  it('renames a tag with Slovak diacritics using the same slug contract', async () => {
    await mount()
    chip('a').querySelector('button')!.click()
    await settle()
    const input = chip('a').querySelector('input')!
    input.value = 'Ľúbim šťastné chvíle'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await settle()
    expect(writes).toEqual([{ method: 'PATCH', body: { name: 'Ľúbim šťastné chvíle', slug: 'lubim-stastne-chvile' } }])
    expect(chip('a').textContent).toContain('Ľúbim šťastné chvíle')
  })
})
