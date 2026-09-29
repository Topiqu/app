// @vitest-environment nuxt

import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import { useArticleGenerationStore } from '../../app/stores/articleGeneration'
import { defaultArticleGenerationOptions } from '../../shared/utils/articleGeneration'

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

let finish: () => void = () => {}
mockNuxtImport('useArticleGeneration', () => () => ({
  generating: { value: false },
  stop: () => {},
  streamGenerate: async (_prompt: string, _options: unknown, handlers: any) => {
    handlers.onSession('session-1')
    handlers.onPartial({ title: 'Draft title', content: '<p>Draft [[IMAGE1]]</p>' })
    handlers.onImage({ slot: 1, html: '<img src="https://img.test/a.png">' })
    await new Promise<void>((resolve) => (finish = resolve))
    handlers.onFinal({ title: 'Final title', perex: 'Perex', content: '<p>Final</p>', tags: ['t1'], metrics: {} })
    handlers.onEvent({ type: 'final', missingModules: [] })
    return 'completed'
  },
}))

describe('article generation store', () => {
  it('keeps the run and its output outside the editor page until the editor clears it', async () => {
    const store = useArticleGenerationStore()
    const run = store.start({
      prompt: 'topic',
      options: defaultArticleGenerationOptions(),
      target: 'new',
      editorPath: '/cs/admin/editor/new',
    })
    await Promise.resolve()

    expect(store.running).toBe(true)
    expect(store.sessionId).toBe('session-1')
    expect(store.article.content).toBe('<p>Draft <img src="https://img.test/a.png"></p>')

    store.clear()
    expect(store.target).toBe('new')

    finish()
    await run
    expect(store.run?.status).toBe('completed')
    expect(store.article).toMatchObject({ title: 'Final title', excerpt: 'Perex', tags: ['t1'], aiInvolvement: 'FULL' })

    store.clear()
    expect(store.run).toBeNull()
    expect(store.target).toBeNull()
  })
})
