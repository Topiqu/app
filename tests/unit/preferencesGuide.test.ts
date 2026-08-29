// @vitest-environment nuxt

import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import ClientPreferencesGuide from '../../app/components/Client/PreferencesGuide.vue'

// Read from disk, not `import`: the i18n plugin compiles imported locale JSON into message
// functions, so every string assertion against it would pass vacuously.
const preferences = (locale: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${locale}/common.json`), 'utf8')).common.preferences

const waitForOverlay = async () => {
  await new Promise((done) => setTimeout(done, 30))
}

const openGuide = async (props: Record<string, unknown>) => {
  await mountSuspended(ClientPreferencesGuide, {
    props: { modelValue: true, ...props },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  })
  await waitForOverlay()
  // Auto-unmount leaves earlier teleported dialogs in <body>, so take the one just mounted.
  return [...document.querySelectorAll('[role="dialog"]')].at(-1) as HTMLElement
}

enableAutoUnmount(afterEach)

describe('content preferences guide', () => {
  // The component builds these paths at runtime, so the static sweep in i18nCompleteness cannot see them.
  it.each(['cs', 'en'])('resolves every dynamically built message key in %s', (locale) => {
    const { guide, ...fields } = preferences(locale)

    expect(Object.keys(guide.flow)).toEqual(['brief', 'topic', 'article', 'publish'])
    for (const key of ['title', 'intro', 'usedIn', 'good', 'bad', 'empty']) expect(guide[key]).toBeTruthy()
    for (const key of ['title', 'hint']) expect(guide.preview[key]).toBeTruthy()

    for (const section of ['focus', 'audience', 'language', 'keywords']) {
      expect(fields[section].label).toBeTruthy()
      expect(guide[section].usedIn).toBeTruthy()
      expect(guide[section].description).toBeTruthy()
    }
    for (const section of ['focus', 'audience', 'keywords']) {
      for (const key of ['good', 'bad', 'empty']) expect(guide[section][key]).toBeTruthy()
    }
    expect(guide.language.warning).toBeTruthy()
    expect(guide.keywords.note).toBeTruthy()
  })

  it('previews filled fields and substitutes the server fallback for empty ones', async () => {
    const dialog = await openGuide({
      focus: 'objective gaming journalism',
      audience: '  ',
      language: 'cs',
      keywords: ['Unreal Engine', 'AI in games'],
    })

    const rows = [...dialog.querySelectorAll('dl > div')].map((row) => row.textContent?.replace(/\s+/g, ' ').trim())

    expect(rows).toEqual([
      'Audience:general',
      'Focus:objective gaming journalism',
      'Keywords:Unreal Engine, AI in games',
      'Language:CS',
    ])
    // The first mount here pays the Nuxt app cold start, which outruns the 5s default once the
    // whole suite is competing for the machine.
  }, 20_000)

  it('flags only the fields that are still empty', async () => {
    const filled = await openGuide({ focus: 'a focus', audience: 'an audience', keywords: ['one'] })
    expect(filled.innerHTML).not.toContain('bg-warning/10')
  }, 20_000)

  it('warns on every empty field when nothing is filled in', async () => {
    const empty = await openGuide({})
    expect(empty.innerHTML.split('bg-warning/10').length - 1).toBe(3)
  }, 20_000)
})
