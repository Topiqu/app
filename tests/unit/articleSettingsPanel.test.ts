// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AiUpsell from '../../app/components/Article/Editor/AiUpsell.vue'
import SettingsPanel from '../../app/components/Article/Editor/SettingsPanel.vue'
import GenerationForm from '../../app/components/Article/Editor/GenerationForm.vue'
import { defaultArticleGenerationOptions } from '../../shared/utils/articleGeneration'

// jsdom has no layout, so no scrolling either.
HTMLElement.prototype.scrollIntoView = vi.fn()

const UTabs = {
  name: 'UTabs',
  props: ['items', 'modelValue'],
  template: '<div><slot name="article" /><slot name="ai" /><slot name="checks" /></div>',
}

const mountPanel = (props: Record<string, unknown> = {}) =>
  shallowMount(SettingsPanel, {
    props: {
      tab: 'ai',
      articleTags: [],
      aiAvailable: true,
      aiGenerating: false,
      customPrompt: '',
      aiOptions: defaultArticleGenerationOptions(),
      releaseAt: null,
      sources: [],
      optimizationState: 'ready',
      optimizationResult: null,
      factCheckState: 'idle',
      factCheckResult: null,
      factCheckCanRun: false,
      factCheckErrorKind: 'generic',
      mediaRightsState: 'ready',
      mediaRightsResult: null,
      ...props,
    } as any,
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } }),
      ],
      stubs: { UTabs },
    },
  })

const checksTab = (wrapper: ReturnType<typeof mountPanel>) =>
  (wrapper.findComponent(UTabs).props('items') as { value: string; badge?: any }[]).find(
    (item) => item.value === 'checks',
  )

describe('article settings panel', () => {
  it('offers the plan upgrade instead of the generation form without an AI plan', () => {
    const locked = mountPanel({ aiAvailable: false })
    expect(locked.findComponent(AiUpsell).exists()).toBe(true)
    expect(locked.findComponent(GenerationForm).exists()).toBe(false)

    const open = mountPanel()
    expect(open.findComponent(GenerationForm).exists()).toBe(true)
    expect(open.findComponent(AiUpsell).exists()).toBe(false)
  })

  it('switches to the Article tab before focusing a sidebar target', async () => {
    const wrapper = mountPanel({ tab: 'checks' })
    const element = await (wrapper.vm as any).focusOptimizationTarget({ kind: 'featured-image' })
    expect(wrapper.emitted('update:tab')?.at(-1)).toEqual(['article'])
    expect(element).toBeInstanceOf(HTMLElement)
  })

  it('leaves targets outside the sidebar to the page', async () => {
    const wrapper = mountPanel({ tab: 'checks' })
    expect(await (wrapper.vm as any).focusOptimizationTarget({ kind: 'title' })).toBeNull()
    expect(wrapper.emitted('update:tab')).toBeUndefined()
  })

  it('badges the Checks tab with media needing attention before the score', () => {
    expect(checksTab(mountPanel())?.badge).toBeUndefined()
    expect(checksTab(mountPanel({ optimizationResult: { overallScore: 82 } }))?.badge).toMatchObject({
      label: 82,
      color: 'success',
    })
    expect(
      checksTab(
        mountPanel({
          optimizationResult: { overallScore: 82 },
          mediaRightsResult: { counts: { needsAttention: 2, recorded: 0 }, items: [] },
        }),
      )?.badge,
    ).toMatchObject({ label: 2, color: 'warning' })
  })
})
