import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, reactive, nextTick } from 'vue'

import { useArticleOptimization } from '../../app/composables/useArticleOptimization'

describe('editor optimization state', () => {
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
