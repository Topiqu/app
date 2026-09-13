// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'

import SettingsPanel from '../../app/components/Article/Editor/SettingsPanel.vue'
import { defaultArticleGenerationOptions } from '../../shared/utils/articleGeneration'

const mountPanel = () => {
  const options = defaultArticleGenerationOptions()
  const wrapper = shallowMount(SettingsPanel, {
    props: {
      articleTags: [],
      aiGenerating: false,
      aiPhase: 'research',
      aiElapsedSeconds: 0,
      aiLastActivitySeconds: 0,
      aiWordCount: 0,
      aiWritingStage: 'starting',
      customPrompt: 'Gaming news',
      aiOptions: options,
      releaseAt: null,
      sources: [],
      aiOpen: true,
    },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } }),
      ],
      renderStubDefaultSlot: true,
      stubs: { UCollapsible: { template: '<div><slot /><slot name="content" /></div>' } },
    },
  })
  return { wrapper, options }
}

describe('article generation module selection', () => {
  it('adds and removes content and media independently, keeping the modules array', async () => {
    const { wrapper, options } = mountPanel()
    const answer = wrapper.get<HTMLInputElement>('input[value="answer"]')
    const poll = wrapper.get<HTMLInputElement>('input[value="poll"]')
    const images = wrapper.get<HTMLInputElement>('input[value="images"]')
    expect(answer.element.checked).toBe(true)
    await poll.setValue(true)
    await images.setValue(true)
    expect(options.modules).toEqual(['answer', 'takeaways', 'poll', 'images'])
    await answer.setValue(false)
    expect(options.modules).toEqual(['takeaways', 'poll', 'images'])
    expect(images.element.checked).toBe(true)
    await images.setValue(false)
    expect(options.modules).toEqual(['takeaways', 'poll'])
    wrapper.unmount()
  })

  it('explains unavailable modules and preserves format restrictions', () => {
    const { wrapper } = mountPanel()
    const faq = wrapper.get<HTMLInputElement>('input[value="faq"]')
    expect(faq.element.disabled).toBe(true)
    expect(faq.element.closest('label')?.textContent).toContain('articles.editor.ai.moduleUnavailable')
    expect(wrapper.get<HTMLInputElement>('input[value="poll"]').element.disabled).toBe(false)
    wrapper.unmount()
  })
})
