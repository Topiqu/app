import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, nextTick } from 'vue'

import { useArticleOptimization } from '../../app/composables/useArticleOptimization'

describe('editor optimization state', () => {
  afterEach(() => vi.useRealTimers())

  it('cancels queued analysis after explicit retry and after the editor unmounts', async () => {
    vi.useFakeTimers()
    const article = reactive({
      title: 'Initial title',
      excerpt: '',
      content: '<p>Initial content.</p>',
      sources: [] as string[],
      imageUrl: null,
      tenantDomain: null,
    })
    let optimization!: ReturnType<typeof useArticleOptimization>
    const wrapper = mount(
      defineComponent({
        setup() {
          optimization = useArticleOptimization(() => article)
          return () => h('div')
        },
      }),
    )
    article.title = 'Updated title'
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    optimization.retry()
    expect(vi.getTimerCount()).toBe(0)
    article.title = 'Changed again'
    await nextTick()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    const result = optimization.result.value
    optimization.retry()
    expect(optimization.result.value).toBe(result)
  })

  it('analyzes content written into an initially blank article', async () => {
    const article = reactive({
      title: '',
      excerpt: '',
      content: '',
      imageUrl: '',
      sources: [] as string[],
      tenantDomain: '',
    })
    let optimization!: ReturnType<typeof useArticleOptimization>
    const Harness = defineComponent({
      setup() {
        optimization = useArticleOptimization(() => article)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)
    expect(optimization.state.value).toBe('empty')

    article.title = 'A generated article about a real event'
    article.content = '<h2>What happened</h2><p>The report describes a verified meeting.</p>'
    await nextTick()
    optimization.retry()

    expect(optimization.state.value).toBe('complete')
    expect(optimization.result.value?.checks.find((check) => check.id === 'title-exists')?.status).toBe('passed')
    wrapper.unmount()
  })
})
