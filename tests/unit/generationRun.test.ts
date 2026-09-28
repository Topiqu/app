import { describe, expect, it } from 'vitest'

import {
  defaultArticleGenerationOptions,
  finishGenerationRun,
  generationSteps,
  missingArticleModules,
  reduceGenerationRun,
  startGenerationRun,
  type GenerationEvent,
  type GenerationRun,
  type YoutubeOutcome,
} from '../../shared/utils/articleGeneration'

const options = () => ({ ...defaultArticleGenerationOptions(), modules: ['answer', 'images', 'youtube'] as const })
const start = () => startGenerationRun({ ...options(), modules: [...options().modules] }, 0)
const play = (run: GenerationRun, events: GenerationEvent[]) =>
  events.reduce((current, event, index) => reduceGenerationRun(current, event, index + 1), run)
const research = (youtube: YoutubeOutcome | undefined): GenerationEvent => ({
  type: 'research',
  status: 'completed',
  sourceCount: 4,
  depth: 'standard',
  sources: [],
  knowledgeSourceCount: 0,
  youtube,
})
const step = (run: GenerationRun, id: string, words = 0) => generationSteps(run, words).find((entry) => entry.id === id)

describe('generation run', () => {
  it('reports research, knowledge and a found video once research lands', () => {
    const run = play(start(), [research({ status: 'found', url: 'https://youtu.be/x', title: 'Trailer' })])
    expect(step(run, 'research')).toMatchObject({ state: 'done', detail: 'research.sources', params: { count: 4 } })
    expect(step(run, 'knowledge')).toMatchObject({ state: 'skipped', detail: 'knowledge.none' })
    expect(step(run, 'youtube')).toMatchObject({ state: 'done', params: { title: 'Trailer' } })
  })

  it('explains why no video was used', () => {
    expect(step(play(start(), [research({ status: 'rejected' })]), 'youtube')).toMatchObject({
      state: 'warning',
      detail: 'youtube.rejected',
    })
    const unused = play(start(), [
      research({ status: 'found', url: 'https://youtu.be/x', title: 'Trailer' }),
      { type: 'final', missingModules: ['youtube'] },
    ])
    expect(step(unused, 'youtube')).toMatchObject({ state: 'warning', detail: 'youtube.notUsed' })
  })

  it('reports partial media and open review issues as a partial result', () => {
    const run = play(start(), [
      research({ status: 'noCandidates' }),
      { type: 'phase', phase: 'writing' },
      { type: 'review', review: { approved: false, revised: false, issues: [{ code: 'filler', note: 'x' }] } },
      { type: 'phase', phase: 'images' },
      { type: 'media', stage: 'complete', completed: 3, total: 3, found: 2, cover: 'library', slots: ['ai', null] },
      { type: 'final', missingModules: [] },
    ])
    expect(step(run, 'review')).toMatchObject({ state: 'warning', params: { count: 1 } })
    expect(step(run, 'media')).toMatchObject({ state: 'warning', params: { found: 2, total: 3 } })
    expect(finishGenerationRun(run, 'completed', 10).status).toBe('partial')
  })

  it('marks the failing step and keeps the credit note', () => {
    const run = play(start(), [research(undefined), { type: 'phase', phase: 'writing' }])
    const failed = finishGenerationRun(run, { message: 'Writer idle', stage: 'writer_idle', creditReturned: true }, 5)
    expect(failed).toMatchObject({ status: 'failed', error: { creditReturned: true } })
    expect(step(failed, 'writing')).toMatchObject({ state: 'failed' })
    expect(step(failed, 'media')).toMatchObject({ state: 'pending' })
  })

  it('treats an error after the final article as a usable partial result', () => {
    const run = play(start(), [{ type: 'final', missingModules: [] }])
    expect(finishGenerationRun(run, { message: 'recovery failed' }, 5).status).toBe('partial')
  })

  it('skips research-dependent steps when research is off', () => {
    const run = startGenerationRun({ ...options(), modules: ['youtube'], research: { ...options().research, enabled: false } }, 0)
    expect(step(run, 'research')).toMatchObject({ state: 'skipped' })
    expect(step(play(run, [{ ...research({ status: 'researchOff' }), status: 'skipped' }]), 'youtube')).toMatchObject({
      state: 'skipped',
    })
  })
})

describe('missingArticleModules', () => {
  it('lists requested components absent from the finished article', () => {
    expect(
      missingArticleModules(
        { answer: 'Yes.', keyTakeaways: [], content: '<p>x</p><img src="a">' },
        ['answer', 'takeaways', 'images', 'youtube'],
      ),
    ).toEqual(['takeaways', 'youtube'])
  })
})
