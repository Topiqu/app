// @vitest-environment nuxt

import { nextTick } from 'vue'
import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import ClientPreferencesGuide from '../../app/components/Client/PreferencesGuide.vue'

// Read from disk: the Nuxt i18n plugin compiles imported JSON into message functions.
const messages = (locale: string, file = 'common') =>
  JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${locale}/${file}.json`), 'utf8'))
const preferences = (locale: string) => messages(locale).common.preferences

const openGuide = async (props: Record<string, unknown> = {}) => {
  const wrapper = await mountSuspended(ClientPreferencesGuide, {
    props: { modelValue: true, ...props },
    attachTo: document.body,
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { ...messages('en'), ...messages('en', 'languages') } },
        }),
      ],
    },
  })
  await nextTick()
  await new Promise((done) => setTimeout(done, 30))
  const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1) as HTMLElement
  return { wrapper, dialog }
}

const button = (dialog: HTMLElement, label: string) =>
  dialog.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
const activeExample = (dialog: HTMLElement) => dialog.querySelector('dl[aria-hidden="false"]')!

enableAutoUnmount(afterEach)

describe('content preferences guide', () => {
  it.each(['cs', 'en', 'de', 'fr'])('resolves the field hints and all example messages in %s', (locale) => {
    const { guide, ...fields } = preferences(locale)

    for (const key of ['title', 'intro']) expect(guide[key]).toBeTruthy()
    for (const key of ['title', 'hint', 'fallback']) expect(guide.preview[key]).toBeTruthy()
    for (const field of ['focus', 'audience', 'language', 'keywords']) {
      expect(fields[field].label).toBeTruthy()
      expect(guide.fields[field]).toBeTruthy()
    }
    for (const key of ['title', 'previous', 'next', 'position']) expect(guide.examples[key]).toBeTruthy()
    expect(Object.keys(guide.examples.items)).toEqual(['gaming', 'coffee', 'software', 'travel', 'running'])
    for (const example of Object.values(guide.examples.items) as Record<string, string>[]) {
      for (const field of ['title', 'focus', 'audience', 'keywords']) expect(example[field]).toBeTruthy()
    }
  })

  it('browses complete example briefs in both directions and loops at the ends', async () => {
    const { dialog } = await openGuide()
    const examples = preferences('en').guide.examples.items
    expect(dialog.querySelector('h3')?.textContent).toBe(examples.gaming.title)

    button(dialog, 'Next example').click()
    await nextTick()
    expect(dialog.querySelector('h3')?.textContent).toBe(examples.coffee.title)
    expect(activeExample(dialog).textContent).toContain(examples.coffee.focus)
    expect(activeExample(dialog).textContent).toContain(examples.coffee.audience)
    expect(activeExample(dialog).textContent).toContain(examples.coffee.keywords)
    expect(dialog.querySelectorAll('dl[aria-hidden="false"]')).toHaveLength(1)

    for (let i = 0; i < 4; i++) {
      button(dialog, 'Next example').click()
      await nextTick()
    }
    expect(dialog.querySelector('h3')?.textContent).toBe(examples.gaming.title)
    button(dialog, 'Previous example').click()
    await nextTick()
    expect(dialog.querySelector('h3')?.textContent).toBe(examples.running.title)
  }, 20_000)

  it('supports arrow keys without moving focus away from the navigation control', async () => {
    const { dialog } = await openGuide()
    const control = button(dialog, 'Previous example')
    control.focus()
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await nextTick()
    expect(dialog.querySelector('h3')?.textContent).toBe(preferences('en').guide.examples.items.running.title)
    expect(document.activeElement).toBe(control)

    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(dialog.querySelector('h3')?.textContent).toBe(preferences('en').guide.examples.items.gaming.title)
  }, 20_000)

  it('keeps the live brief collapsed and independent of the browsed examples', async () => {
    const { wrapper, dialog } = await openGuide({
      focus: 'objective gaming journalism',
      audience: '  ',
      language: 'cs',
      keywords: ['Unreal Engine', 'AI in games'],
    })
    const disclosure = dialog.querySelector('details')!
    expect(disclosure.open).toBe(false)

    button(dialog, 'Next example').click()
    await nextTick()
    disclosure.querySelector('summary')!.click()
    expect(disclosure.open).toBe(true)

    const values = [...disclosure.querySelectorAll('dd > span:first-child')].map((value) => value.textContent)
    expect(values).toEqual(['general', 'objective gaming journalism', 'Unreal Engine, AI in games', 'CS'])
    expect(disclosure.querySelector('dl')?.textContent?.match(/default value/g)).toHaveLength(1)

    await wrapper.setProps({ audience: 'game developers' })
    expect(disclosure.textContent).toContain('game developers')
    expect(disclosure.querySelector('dl')?.textContent).not.toContain('default value')

    disclosure.querySelector('summary')!.click()
    expect(disclosure.open).toBe(false)
  }, 20_000)
})
