import { describe, expect, it } from 'vitest'

import {
  defaultArticleGenerationOptions,
  finishGenerationRun,
  generationSteps,
  missingArticleModules,
  reduceGenerationRun,
  releaseHoldOf,
  startGenerationRun,
  writtenHeadings,
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

  it('shows issues left after a revision instead of a green review step', () => {
    const review = (approved: boolean): GenerationEvent => ({
      type: 'review',
      review: {
        approved,
        revised: true,
        issues: approved ? [] : [{ code: 'invented_detail', note: 'x' }],
        resolvedIssues: [{ code: 'hedging', note: 'y' }],
      },
    })
    expect(step(play(start(), [review(true)]), 'review')).toMatchObject({
      state: 'done',
      detail: 'review.revised',
      params: { count: 1 },
    })
    expect(step(play(start(), [review(false)]), 'review')).toMatchObject({
      state: 'warning',
      detail: 'review.revisedIssues',
      params: { count: 1 },
    })
  })

  it('counts only blocking issues as left for manual review', () => {
    const run = play(start(), [
      {
        type: 'review',
        review: {
          approved: false,
          revised: true,
          issues: [
            { code: 'invented_detail', note: 'x', blocking: true },
            { code: 'hedging', note: 'y', blocking: false },
          ],
        },
      },
    ])
    expect(step(run, 'review')).toMatchObject({ state: 'warning', params: { count: 1 } })
  })

  it('names every reason the autopilot held an article and only its blocking findings', () => {
    const hold = releaseHoldOf({
      review: {
        approved: false,
        revised: true,
        issues: [
          { code: 'missing_specifics', note: 'Name a change.', blocking: true },
          { code: 'hedging', note: 'Tip.', blocking: false },
        ],
      },
      researchApproved: true,
      mediaApproved: false,
      coverApproved: false,
    })
    expect(hold).toEqual({
      reasons: ['review', 'media', 'cover'],
      issues: [{ code: 'missing_specifics', note: 'Name a change.', key: undefined, params: undefined }],
    })
    expect(
      releaseHoldOf({
        review: { approved: true, revised: false },
        researchApproved: false,
        mediaApproved: true,
        coverApproved: true,
      }).reasons,
    ).toEqual(['research'])
  })

  it('shows the actual review stage and records only received progress as activity', () => {
    let run = start()
    for (const [index, stage] of (['verifying', 'checking', 'revising', 'rechecking'] as const).entries()) {
      run = reduceGenerationRun(run, { type: 'review-progress', stage }, (index + 1) * 10_000)
      expect(step(run, 'review')).toMatchObject({ state: 'running', detail: `review.${stage}` })
      expect(step(run, 'writing')).toMatchObject({ state: 'done' })
      expect(run.lastActivityAt).toBe((index + 1) * 10_000)
      expect(run.review).toBeNull()
    }
    run = reduceGenerationRun(run, { type: 'review', review: { approved: true, revised: false } }, 50_000)
    expect(step(run, 'review')).toMatchObject({ state: 'done', detail: 'review.approved' })
  })

  it('keeps the generic review label for older runs without a detailed stage', () => {
    const run = play(start(), [
      { type: 'phase', phase: 'writing' },
      { type: 'activity', writingStage: 'review' },
    ])
    expect(step(run, 'review')).toMatchObject({ state: 'running', detail: 'review.running' })
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

  it('does not pass off steps a page load never reported as pending once the run is resumed', () => {
    const run = play(start(), [research(undefined), { type: 'phase', phase: 'images' }])
    const resumed = finishGenerationRun({ ...run, resumed: true }, 'completed', 10)
    expect(step(resumed, 'research')).toMatchObject({ state: 'done' })
    expect(step(resumed, 'writing', 120)).toMatchObject({ state: 'done', params: { count: 120 } })
    expect(step(resumed, 'review')).toMatchObject({ state: 'skipped', detail: 'resumed' })
    expect(step(resumed, 'media')).toMatchObject({ state: 'skipped', detail: 'resumed' })
  })

  it('skips research-dependent steps when research is off', () => {
    const run = startGenerationRun(
      { ...options(), modules: ['youtube'], research: { ...options().research, enabled: false } },
      0,
    )
    expect(step(run, 'research')).toMatchObject({ state: 'skipped' })
    expect(step(play(run, [{ ...research({ status: 'researchOff' }), status: 'skipped' }]), 'youtube')).toMatchObject({
      state: 'skipped',
    })
  })
})

describe('missingArticleModules', () => {
  it('lists requested components absent from the finished article', () => {
    expect(
      missingArticleModules({ answer: 'Yes.', keyTakeaways: [], content: '<p>x</p><img src="a">' }, [
        'answer',
        'takeaways',
        'images',
        'youtube',
      ]),
    ).toEqual(['takeaways', 'youtube'])
  })
})

describe('writer clocks', () => {
  it('marks the writer as thinking until its first text', () => {
    const run = play(start(), [
      { type: 'phase', phase: 'writing' },
      { type: 'activity', writingStage: 'starting' },
      { type: 'activity', writingStage: 'title' },
      { type: 'activity', writingStage: 'body' },
    ])
    expect(play(start(), [{ type: 'activity', writingStage: 'starting' }]).textAt).toBeUndefined()
    expect(run.textAt).toBe(3)
  })

  it('treats a cut run as a partial result with a warning on the writing step', () => {
    const run = play(start(), [
      { type: 'phase', phase: 'writing' },
      { type: 'phase', phase: 'images' },
      { type: 'final', missingModules: [], cut: true },
    ])
    expect(step(run, 'writing', 300)).toMatchObject({ state: 'warning', detail: 'writing.cut', params: { count: 300 } })
    expect(finishGenerationRun(run, 'completed', 9).status).toBe('partial')
  })

  it('says the remaining fields are being written once the writer was cut', () => {
    const run = play(start(), [
      { type: 'phase', phase: 'writing' },
      { type: 'activity', writingStage: 'finishing' },
    ])
    expect(step(run, 'writing', 640)?.detail).toBe('writing.finishing')
  })

  it('points a thinking timeout at the writing step', () => {
    const run = finishGenerationRun(
      play(start(), [{ type: 'phase', phase: 'writing' }]),
      { message: 'stopped', stage: 'writer_thinking', creditReturned: true },
      9,
    )
    expect(step(run, 'writing')?.state).toBe('failed')
  })
})

describe('writtenHeadings', () => {
  it('reads closed H2 headings as text and ignores the one still streaming', () => {
    expect(
      writtenHeadings(
        '<h2 id="a">Cena &amp; dotace</h2><p>Text</p><h2><strong>Instalace</strong></h2><h3>Ne</h3><h2>Neú',
      ),
    ).toEqual(['Cena & dotace', 'Instalace'])
    expect(writtenHeadings(null)).toEqual([])
  })
})
