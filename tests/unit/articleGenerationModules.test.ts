// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import SettingsPanel from '../../app/components/Article/Editor/SettingsPanel.vue'
import { defaultArticleGenerationOptions } from '../../shared/utils/articleGeneration'

mockNuxtImport('useLocalePath', () => () => (route: unknown) => route)

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
  it('enables labelled AI fallback by default', () => {
    expect(defaultArticleGenerationOptions().allowGeneratedImages).toBe(true)
  })

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

  it('hides unavailable modules instead of filling the form with disabled controls', () => {
    const { wrapper } = mountPanel()
    expect(wrapper.find<HTMLInputElement>('input[value="faq"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[value="poll"]').element.disabled).toBe(false)
    wrapper.unmount()
  })
})
