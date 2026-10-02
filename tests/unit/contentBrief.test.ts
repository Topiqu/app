// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import Content from '../../app/components/Form/Client/Content.vue'

const props = { focus: '', audience: '', language: 'cs' as const, keywords: ['Unreal Engine'] }
const mounted: Array<{ unmount: () => void }> = []
const mountBrief = async () => {
  const wrapper = await mountSuspended(Content, {
    props,
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })],
    },
  })
  mounted.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

const keywordInput = (wrapper: Awaited<ReturnType<typeof mountBrief>>) => wrapper.get('[data-slot="input"]')

describe('content brief controls', () => {
  it('commits a keyword with Enter and clears the input', async () => {
    const wrapper = await mountBrief()
    const input = keywordInput(wrapper)
    await input.setValue('AI ve hrách')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:keywords')?.at(-1)).toEqual([['Unreal Engine', 'AI ve hrách']])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('commits a pasted comma list without duplicating existing keywords', async () => {
    const wrapper = await mountBrief()
    await keywordInput(wrapper).trigger('paste', {
      clipboardData: { getData: () => 'unreal engine, RPG, AI' },
    })
    expect(wrapper.emitted('update:keywords')?.at(-1)).toEqual([['Unreal Engine', 'RPG', 'AI']])
  })

  it('removes the last keyword with Backspace on an empty input', async () => {
    const wrapper = await mountBrief()
    await keywordInput(wrapper).trigger('keydown', { key: 'Backspace' })
    await keywordInput(wrapper).trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:keywords')?.at(-1)).toEqual([[]])
  })

  it('labels every control and shows the selected language', async () => {
    const wrapper = await mountBrief()
    for (const label of wrapper.findAll('label[for]')) {
      expect(document.getElementById(label.attributes('for')!)).not.toBeNull()
    }
    expect(wrapper.findAll('label[for]')).toHaveLength(4)
    const select = wrapper.get('[role="combobox"]')
    expect(select.attributes('aria-label')).toBeUndefined()
    expect(select.text()).toContain('languages.cs')
  })
})
