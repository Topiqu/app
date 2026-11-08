// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { GenerationEvent } from '../../shared/utils/articleGeneration'

import Run from '../../app/components/Article/Editor/GenerationRun.vue'
import {
  defaultArticleGenerationOptions,
  finishGenerationRun,
  reduceGenerationRun,
  startGenerationRun,
} from '../../shared/utils/articleGeneration'

const translate = (key: string, params?: Record<string, string | number>) => {
  if (key === 'articles.editor.ai.run.research.sources') return `Nalezené zdroje: ${params?.count}`
  if (key === 'articles.editor.ai.run.review.waiting') return `waiting:${params?.seconds}`
  if (key === 'articles.editor.ai.run.note.correctClaim') return `Opravte: ${params?.claim}`
  return key
}
mockNuxtImport('useI18n', () => () => ({
  t: translate,
  te: (key: string) => key === 'articles.editor.ai.run.note.correctClaim',
}))
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

  it('shows system-written review notes in the interface language and model notes as written', async () => {
    const run = reduceGenerationRun(
      running(),
      {
        type: 'review',
        review: {
          approved: false,
          revised: true,
          issues: [
            {
              code: 'unsupported_claim',
              note: 'Remove or correct this claim: CONTRADICTED …',
              key: 'correctClaim',
              params: { claim: 'CONTRADICTED: Karel Urban' },
            },
            { code: 'assignment_mismatch', note: 'Vyprávěč zní jako zpráva.' },
          ],
        },
      },
      Date.now(),
    )
    const wrapper = await mountSuspended(Run, { props: { run, words: 500 }, global })
    expect(wrapper.text()).toContain('Opravte: CONTRADICTED: Karel Urban')
    expect(wrapper.text()).not.toContain('Remove or correct this claim')
    expect(wrapper.text()).toContain('Vyprávěč zní jako zpráva.')
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

describe('generation report actions', () => {
  const play = (events: GenerationEvent[]) =>
    events.reduce((run, event) => reduceGenerationRun(run, event, Date.now()), running())
  const finished = (events: GenerationEvent[]) =>
    finishGenerationRun(play([...events, { type: 'final', missingModules: [] }]), 'completed', Date.now())
  const buttonNamed = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, label: string) =>
    wrapper.findAll('button').find((button) => button.text() === label)!

  it('offers a fix for each problem and jumps to the chosen images', async () => {
    const run = finished([
      {
        type: 'research',
        status: 'fallback',
        fallbackReason: 'timeout',
        sourceCount: 0,
        depth: 'standard',
        sources: [],
      },
      { type: 'review', review: { approved: true, revised: false } },
      {
        type: 'media',
        stage: 'complete',
        completed: 3,
        total: 3,
        found: 2,
        cover: 'ai',
        slots: [null, 'library'],
        coverUrl: 'https://cdn.test/cover.webp',
        slotUrls: [null, 'https://cdn.test/two.webp'],
        gaps: [{ slot: 1, query: 'Atmos DC 25 S boiler room', after: 'Cenaadotace' }],
      },
    ])
    const wrapper = await mountSuspended(Run, { props: { run, words: 747, canVerify: true }, global })

    expect(run.status).toBe('partial')
    expect(wrapper.text()).toContain('articles.editor.ai.run.attention')
    expect(wrapper.text()).toContain('articles.editor.ai.run.research.fallback.timeout')
    await buttonNamed(wrapper, 'articles.editor.ai.run.action.verify').trigger('click')
    await buttonNamed(wrapper, 'articles.editor.ai.run.action.pickImage').trigger('click')
    expect(wrapper.emitted('verify')).toHaveLength(1)
    expect(wrapper.emitted('fillImage')).toEqual([['Cenaadotace']])

    const show = wrapper.findAll('button[aria-label="articles.editor.ai.run.action.show"]')
    expect(show).toHaveLength(2)
    await show[0]!.trigger('click')
    await show[1]!.trigger('click')
    expect(wrapper.emitted('showCover')).toHaveLength(1)
    expect(wrapper.emitted('showImage')).toEqual([['https://cdn.test/two.webp']])
  })

  it('leaves out the fact check when there is nothing to check yet', async () => {
    const run = finished([
      { type: 'research', status: 'fallback', fallbackReason: 'error', sourceCount: 0, depth: 'standard', sources: [] },
    ])
    const wrapper = await mountSuspended(Run, { props: { run, words: 0 }, global })
    expect(wrapper.text()).toContain('articles.editor.ai.run.research.fallback.error')
    expect(buttonNamed(wrapper, 'articles.editor.ai.run.action.verify')).toBeUndefined()
  })

  it('folds a clean run into its header until the summary is opened', async () => {
    const run = finished([
      {
        type: 'research',
        status: 'completed',
        sourceCount: 3,
        depth: 'standard',
        sources: [],
        knowledgeSourceCount: 1,
      },
      { type: 'review', review: { approved: true, revised: true, resolvedIssues: [] } },
      { type: 'media', stage: 'complete', completed: 1, total: 1, found: 1, cover: 'library', slots: [] },
    ])
    const wrapper = await mountSuspended(Run, { props: { run, words: 600 }, global })

    expect(run.status).toBe('completed')
    expect(wrapper.text()).not.toContain('articles.editor.ai.run.stats.web')
    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(wrapper.text()).toContain('articles.editor.ai.run.stats.web')
    expect(wrapper.text()).not.toContain('articles.editor.ai.run.todo.title')
  })

  it('shows the outline while the text is being written', async () => {
    const run = play([
      { type: 'phase', phase: 'writing' },
      { type: 'activity', writingStage: 'body' },
    ])
    const wrapper = await mountSuspended(Run, { props: { run, words: 120, outline: ['Cena', 'Instalace'] }, global })
    expect(wrapper.text()).toContain('articles.editor.ai.run.now.writing')
    expect(wrapper.text()).toContain('Instalace')
    expect(wrapper.text()).toContain('articles.editor.ai.run.writingNow')
    expect(wrapper.get('[aria-current="step"]').text()).toContain('articles.editor.ai.run.step.writing')
  })
})
