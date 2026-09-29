// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'

import GenerationForm from '../../app/components/Article/Editor/GenerationForm.vue'
import { defaultArticleGenerationOptions } from '../../shared/utils/articleGeneration'

const mountForm = () => {
  const options = defaultArticleGenerationOptions()
  const wrapper = shallowMount(GenerationForm, {
    props: { aiGenerating: false, customPrompt: 'Gaming news', aiOptions: options },
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
    const { wrapper, options } = mountForm()
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

  it('offers every module as an enabled choice', () => {
    const { wrapper } = mountForm()
    for (const module of ['faq', 'table', 'youtube'])
      expect(wrapper.get<HTMLInputElement>(`input[value="${module}"]`).element.disabled).toBe(false)
    wrapper.unmount()
  })

  it('keeps the brief visible but disables changes while generating', async () => {
    const { wrapper } = mountForm()
    await wrapper.setProps({ aiGenerating: true })
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
