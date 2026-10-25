// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Run from '../../app/components/Article/Editor/GenerationRun.vue'
import {
  defaultArticleGenerationOptions,
  reduceGenerationRun,
  startGenerationRun,
} from '../../shared/utils/articleGeneration'

const translate = (key: string, params?: Record<string, string | number>) => {
  if (key === 'articles.editor.ai.run.research.sources') return `Nalezené zdroje: ${params?.count}`
  if (key === 'articles.editor.ai.run.review.waiting') return `waiting:${params?.seconds}`
  return key
}
mockNuxtImport('useI18n', () => () => ({ t: translate, te: () => false }))
mockNuxtImport('useLocalePath', () => () => () => '/admin/knowledge')

const global = { mocks: { $t: translate }, stubs: { AppMedia: true, UIcon: true } }
const running = () => startGenerationRun(defaultArticleGenerationOptions(), Date.now())

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-10-25T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('generation report details', () => {
  it('expands the research count into safe, readable source links', async () => {
    const sources = ['https://example.com/research', 'https://example.org/a/long/path?query=research']
    const run = reduceGenerationRun(
      running(),
      { type: 'research', status: 'completed', sourceCount: 2, depth: 'standard', sources },
      Date.now(),
    )
    const wrapper = await mountSuspended(Run, { props: { run, words: 0 }, global })
    const toggle = wrapper.get('button[aria-expanded]')
    expect(toggle.text()).toContain('Nalezené zdroje: 2')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    for (const source of sources) {
      const link = wrapper.get(`a[href="${source}"]`)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('updates review details only on real events while the waiting time keeps advancing', async () => {
    let run = reduceGenerationRun(running(), { type: 'review-progress', stage: 'verifying' }, Date.now())
    const wrapper = await mountSuspended(Run, { props: { run, words: 500 }, global })
    expect(wrapper.text()).toContain('articles.editor.ai.run.review.verifying')
    await vi.advanceTimersByTimeAsync(21_000)
    expect(wrapper.text()).toContain('waiting:21')
    expect(wrapper.text()).toContain('articles.editor.ai.run.review.verifying')
    run = reduceGenerationRun(run, { type: 'review-progress', stage: 'checking' }, Date.now())
    await wrapper.setProps({ run })
    expect(wrapper.text()).toContain('articles.editor.ai.run.review.checking')
    expect(wrapper.text()).not.toContain('waiting:')
  })
})
