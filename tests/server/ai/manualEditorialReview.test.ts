import { streamText } from 'ai'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/aiUsage'), 'recordAiUsage')
  await stubNitroImports(import('../../../server/utils/ai/articleUsage'), 'withArticleUsageStage')
  await stubNitroImports(import('../../../server/utils/images/verify'), 'imageDepicts')
  await stubNitroImports(import('../../../server/utils/ai/formats'), 'applyFormat', 'formatRules', 'selectedModulesFor')
  await stubNitroImports(import('../../../server/utils/sanitize'), 'escapeHtml')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../server/utils/ai/articleLinks'), 'linkArticle')
  await stubNitroImports(
    import('../../../server/utils/images/selection'),
    'createImageSelection',
    'photoSubjectQuery',
    'matchesImageQuery',
  )
  await stubNitroImports(import('../../../server/utils/images/http'), 'fetchJson', 'imageApiHeaders')
  await stubNitroImports(import('../../../server/utils/images/openverse'), 'openverse')
  await stubNitroImports(import('../../../server/utils/images/wikimedia'), 'wikimedia')
  await stubNitroImports(import('../../../server/utils/images/chain'), 'findStockImage')
  await stubNitroImports(
    import('../../../server/utils/images/stores'),
    'storeMediaSource',
    'matchesStoreTitle',
    'storeSearchTerm',
  )
  await stubNitroImports(import('../../../server/utils/images/steam'), 'createSteamImageSearch')
  await stubNitroImports(import('../../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../../server/utils/articleGenerationAudit'), 'auditArticleStep')
  await stubNitroImports(import('../../../server/utils/images/appStore'), 'createAppStoreImageSearch')
  await stubNitroImports(import('../../../server/utils/images/caption'), 'buildImageHtml')
  await stubNitroImports(import('../../../server/utils/storage'), 'putToCdn')
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
  await stubNitroImports(
    import('../../../server/utils/images/optimize'),
    'optimizeGeneratedImage',
    'IMMUTABLE_IMAGE_CACHE_CONTROL',
  )
  await stubNitroImports(
    import('../../../server/utils/images/press'),
    'findPressImage',
    'loadPressImages',
    'youtubeThumbnailImage',
  )
  await stubNitroImports(import('../../../server/utils/ai/articleMedia'), 'finalizeArticle')
  await stubNitroImports(
    import('../../../server/utils/ai/researchEvidence'),
    'filterResearchSources',
    'researchTopic',
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/editorialPolicy'),
    'editorialPolicy',
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(import('../../../server/utils/ai/insight'), 'insightSchema')
  await stubNitroImports(import('../../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../../server/utils/community'), 'readCommunityInsight')
  await stubNitroImports(
    import('../../../server/utils/ai/articleQuality'),
    'buildRevisionPrompt',
    'buildEditPrompt',
    'buildRemovalPrompt',
    'revisionEditsSchema',
    'applyRevisionEdits',
    'isRemovable',
    'reviewArticle',
    'recheckRevision',
    'revisionEvidence',
    'AUTHOR_ACCOUNT_RULE',
  )
  await stubNitroImports(import('../../../server/utils/knowledge/retrieve'), 'retrieveKnowledge')
  await stubNitroImports(import('../../../server/utils/ai/articleConfig'), 'buildArticleConfig')
}

await stubImports()

const { streamArticle } = await import('../../../server/utils/ai/article')

const { generateStructuredText, generatePlainText } = vi.hoisted(() => ({
  generateStructuredText: vi.fn<(typeof import('ai'))['generateText']>(),
  generatePlainText: vi.fn<(typeof import('ai'))['generateText']>(),
}))

vi.mock('ai', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('ai')>()
  return {
    ...sdk,
    generateText: (options: Parameters<typeof sdk.generateText>[0]) =>
      options.output ? generateStructuredText(options) : generatePlainText(options),
    streamText: vi.fn(() => ({})),
  }
})

const draft = {
  title: 'The Witcher 4: Ciri',
  perex: 'A supported introduction.',
  content: '<h2>Ciri</h2><p>A draft.</p>',
  answer: '',
  keyTakeaways: [],
  faq: [],
  coverImage: { type: 'photo' as const, query: 'Witcher 4 Ciri', broaderQuery: '' },
  images: [],
  polls: [],
  videos: [],
  tags: [],
  sources: [],
}
const rejected = {
  issues: [
    { code: 'unsupported_claim', note: 'Remove the unsupported claim about returning characters.', blocking: true },
  ],
}
const approved = { issues: [] }
const fixed = { findings: [{ id: 1, resolved: true }], introduced: [] }
const unfixed = { findings: [{ id: 1, resolved: false }], introduced: [] }
const response = (object: unknown, totalTokens: number) => ({ output: object, usage: { totalTokens } })
/** The edit list the reviser returns for a revised draft; only a reversed stance gets a full rewrite. */
const asEdits = (revision: Partial<typeof draft>) => ({
  edits:
    revision.content && revision.content !== draft.content
      ? [{ find: draft.content, replace: revision.content, insertAfter: false }]
      : [],
  title: revision.title && revision.title !== draft.title ? revision.title : null,
  perex: null,
  answer: null,
  keyTakeaways: null,
  faq: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(generateStructuredText).mockReset()
  vi.mocked(generatePlainText).mockReset()
  vi.stubGlobal('prisma', {
    clientSite: { findFirstOrThrow: vi.fn().mockResolvedValue({ language: 'en' }) },
    knowledgeSource: { findFirst: vi.fn().mockResolvedValue(null) },
  })
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('getServerTranslator', async () => () => 'Review failed')
})
afterEach(() => vi.unstubAllGlobals())

describe('manual editorial review', () => {
  it('checks the revision before approving it and accounts for every call', async () => {
    const revision = { ...draft, title: 'Ciri leads The Witcher 4' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(response(fixed, 5) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    const progress = vi.fn()
    expect(await generation.review(draft, progress)).toEqual(revision)
    expect(progress.mock.calls.map(([stage]) => stage)).toEqual(['checking', 'revising', 'rechecking'])
    expect(generation.editorialReview).toMatchObject({
      approved: true,
      revised: true,
      checkedAfterRevision: true,
      resolvedIssues: rejected.issues,
    })
    expect(generateStructuredText).toHaveBeenCalledTimes(3)
    expect(generation.editorialTokens).toBe(35)
    expect(vi.mocked(generateStructuredText).mock.calls[0]![0].prompt).toContain('"polls":[]')
    expect(vi.mocked(generateStructuredText).mock.calls[2]![0].prompt).toContain(revision.title)
  })

  it('does not approve a rewrite that still repeats the absence of confirmation', async () => {
    const emptyAngle = {
      issues: [
        {
          code: 'missing_specifics',
          note: 'Three sections repeat that no connection is confirmed; compare the documented positions instead.',
          blocking: true,
        },
      ],
    }
    const revision = { ...draft, content: '<h2>No announcement</h2><p>No connection is confirmed.</p>' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(emptyAngle, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(response(unfixed, 5) as never)
    const generation = await streamArticle('site', 'Compare the two positions', {
      research: false,
      format: 'comparison',
      modules: [],
    })

    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({
      approved: false,
      revised: true,
      checkedAfterRevision: true,
      issues: emptyAngle.issues,
      resolvedIssues: [],
    })
    expect(generateStructuredText).toHaveBeenCalledTimes(3)
    expect(vi.mocked(generateStructuredText).mock.calls[1]![0].prompt).toContain(
      'rebuild the thesis and section progression',
    )
  })

  it('keeps a rewritten draft available without falsely approving it when rechecking fails', async () => {
    const revision = { ...draft, title: 'A concrete comparison' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockRejectedValueOnce(new Error('review unavailable'))
    vi.stubGlobal('reportCaughtError', vi.fn())
    const generation = await streamArticle('site', 'Compare the two positions', { research: false })

    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({ approved: false, revised: true, checkedAfterRevision: false })
    expect(generation.editorialReview?.issues[0]?.note).toContain('could not be checked')
    expect(generation.editorialTokens).toBe(30)
  })

  it('reuses verified premises for the final copy desk without repeating web verification', async () => {
    const source = 'https://example.test/positions'
    const correction = 'https://example.test/decision'
    vi.stubGlobal('aiWebSearchTool', () => ({}))
    vi.mocked(generatePlainText)
      .mockResolvedValueOnce({
        text: `The organizations describe different decision-making policies. ${source}`,
        sources: [{ sourceType: 'url', url: source }],
        usage: { totalTokens: 4 },
      } as never)
      .mockResolvedValueOnce({
        text: `SUPPORTED: The first organization centralizes decisions. ${correction}`,
        sources: [{ sourceType: 'url', url: correction }],
        usage: { totalTokens: 7 },
      } as never)
    const revision = { ...draft, title: 'Two conflicting ways to decide' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(
        response(
          {
            issues: [
              {
                code: 'missing_specifics',
                note: 'Replace the repeated caveats with a comparison of who decides.',
                blocking: true,
              },
            ],
          },
          10,
        ) as never,
      )
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(response(fixed, 5) as never)
    const generation = await streamArticle('site', 'Compare decision-making', { format: 'comparison', modules: [] })

    const progress = vi.fn()
    expect((await generation.review({ ...draft, sources: [source] }, progress)).title).toBe(revision.title)
    expect(progress.mock.calls.map(([stage]) => stage)).toEqual(['verifying', 'checking', 'revising', 'rechecking'])
    expect(generatePlainText).toHaveBeenCalledTimes(2)
    expect(vi.mocked(generateStructuredText).mock.calls[2]![0].prompt).toContain(correction)
    expect(generation.editorialTokens).toBe(42)
    expect(generation.editorialReview).toMatchObject({ approved: true, revised: true, checkedAfterRevision: true })
  })

  it.each(['news', 'opinion'] as const)('gives the writer and reviewer the same HIGH policy for %s', async (format) => {
    vi.mocked(prisma.clientSite.findFirstOrThrow).mockResolvedValue({
      language: 'en',
      aiControversyLevel: 'HIGH',
    } as never)
    vi.mocked(generateStructuredText).mockResolvedValueOnce(response(approved, 10) as never)
    const generation = await streamArticle('site', 'Explain the contrast', { research: false, format, modules: [] })
    await generation.review(draft)
    const writer = vi.mocked(streamText).mock.calls.at(-1)![0].instructions as string
    const reviewer = vi.mocked(generateStructuredText).mock.calls[0]![0].instructions as string
    for (const instructions of [writer, reviewer]) {
      expect(instructions).toContain('Use a bold, opinionated voice')
      expect(instructions).toContain('Sources establish the factual premises')
      if (format === 'news')
        expect(instructions).toContain('even HIGH controversy does not turn news into an opinion column')
      else expect(instructions).toContain('Opinion: defend the position the author actually requested')
    }
    expect(generation.editorialReview?.approved).toBe(true)
  })

  it.each(['opinion', 'story'] as const)(
    'carries a confrontational %s through writing, review, revision and rechecking',
    async (format) => {
      const tone = 'direct, aggressive, vulgar'
      vi.mocked(prisma.clientSite.findFirstOrThrow).mockResolvedValue({
        language: 'cs',
        aiControversyLevel: 'HIGH',
        aiToneOfVoice: tone,
      } as never)
      const mismatch = {
        issues: [
          {
            code: 'assignment_mismatch',
            note: 'The title lectures the author about insults. Restore the requested political argument and tone.',
            blocking: true,
          },
        ],
      }
      const moralizing = { ...draft, title: 'Jsou komunisté tupci? Urážka argument nenahradí' }
      const revision = { ...draft, title: 'Komunistické sliby svobody jsou podvod' }
      vi.mocked(generateStructuredText)
        .mockResolvedValueOnce(response(mismatch, 10) as never)
        .mockResolvedValueOnce(response(revision, 20) as never)
        .mockResolvedValueOnce(response(fixed, 5) as never)
      const generation = await streamArticle('site', 'Jebat komouše', {
        research: false,
        format,
        modules: [],
      })

      expect(await generation.review(moralizing)).toEqual(revision)
      const writer = vi.mocked(streamText).mock.calls.at(-1)![0]
      for (const call of [writer, ...vi.mocked(generateStructuredText).mock.calls.map(([options]) => options)]) {
        expect(call.instructions).toContain(tone)
        expect(call.instructions).toContain('Deliberately confrontational writing is part of this assignment')
        expect(call.instructions).toContain('Correct only the defective factual premise')
      }
      expect(vi.mocked(generateStructuredText).mock.calls[1]![0].prompt).toContain('assignment_mismatch')
      expect(generation.editorialReview).toMatchObject({
        approved: true,
        revised: true,
        resolvedIssues: mismatch.issues,
      })
      expect(generatePlainText).not.toHaveBeenCalled()
      expect(generation.editorialTokens).toBe(35)
    },
  )

  it('keeps an assignment mismatch blocking after the single revision', async () => {
    const mismatch = {
      issues: [
        {
          code: 'assignment_mismatch',
          note: 'Replace the unsolicited nonviolence lesson with the requested argument.',
          blocking: true,
        },
      ],
    }
    const moralizing = { ...draft, title: 'Want Communism Defeated? Fight It Without Bloodshed' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(mismatch, 10) as never)
      .mockResolvedValueOnce(response(moralizing, 20) as never)
      .mockResolvedValueOnce(response(unfixed, 5) as never)
    const generation = await streamArticle('site', 'Fuck communism', {
      research: false,
      format: 'opinion',
      modules: [],
    })

    expect(await generation.review(moralizing)).toEqual(moralizing)
    expect(generation.editorialReview).toMatchObject({
      approved: false,
      revised: true,
      checkedAfterRevision: true,
      issues: mismatch.issues,
      resolvedIssues: [],
    })
    expect(generateStructuredText).toHaveBeenCalledTimes(3)
    expect(generation.editorialTokens).toBe(35)
  })

  it('returns the reviewed original with a warning when the revision call fails', async () => {
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockRejectedValueOnce(new Error('revision unavailable'))
    vi.stubGlobal('reportCaughtError', vi.fn())
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toEqual(draft)
    expect(generation.editorialReview).toMatchObject({ approved: false, revised: false })
    expect(generation.editorialTokens).toBe(10)
  })

  it('revises non-blocking edits but never holds the article for them', async () => {
    const edits = {
      issues: [
        { code: 'missing_specifics', note: 'Add the fine tiers from the brief to the cost section.', blocking: false },
        { code: 'hedging', note: 'Delete the sentence telling readers to check elsewhere.', blocking: true },
      ],
    }
    const revision = { ...draft, title: 'Fines up to 2 million' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(edits, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(response({ findings: [], introduced: [] }, 5) as never)
    const generation = await streamArticle('site', 'Write a guide', { research: false })

    expect(await generation.review(draft)).toEqual(revision)
    // Hedging never blocks, whatever the copy desk says; unresolved edits stay as tips.
    expect(generation.editorialReview).toMatchObject({ approved: true, revised: true })
    expect(generation.editorialReview?.issues.every((issue) => !issue.blocking)).toBe(true)
  })

  it('keeps the reviewed original publishable when only edits were pending and the revision fails', async () => {
    const edits = {
      issues: [{ code: 'missing_specifics', note: 'Add the subsidy cap from the brief.', blocking: false }],
    }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(edits, 10) as never)
      .mockRejectedValueOnce(new Error('revision unavailable'))
    vi.stubGlobal('reportCaughtError', vi.fn())
    const generation = await streamArticle('site', 'Write a guide', { research: false })

    expect(await generation.review(draft)).toEqual(draft)
    expect(generation.editorialReview).toMatchObject({ approved: true, revised: false })
  })

  describe('a revision that adds an ungrounded specific', () => {
    const revision = { ...draft, content: '<p>The fine is up to 7 million.</p>' }
    const added = response(
      { findings: [{ id: 1, resolved: true }], introduced: [{ note: 'Remove "up to 7 million"; no source.' }] },
      5,
    )
    const removal = (find: string, replace: string) =>
      response({ ...asEdits({}), edits: [{ find, replace, insertAfter: false }] }, 3)

    it('deletes it in a second, removal-only pass and then publishes', async () => {
      vi.mocked(generateStructuredText)
        .mockResolvedValueOnce(response(rejected, 10) as never)
        .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
        .mockResolvedValueOnce(added as never)
        .mockResolvedValueOnce(removal('<p>The fine is up to 7 million.</p>', '') as never)
        .mockResolvedValueOnce(response(fixed, 2) as never)
      const generation = await streamArticle('site', 'Write a report', { research: false })

      expect((await generation.review(draft)).content).toBe('')
      expect(generation.editorialReview).toMatchObject({ approved: true, removalPass: true, revisionMode: 'edits' })
      expect(generation.editorialTokens).toBe(40)
      // The removal pass runs on the cheap copy-desk model, never the writer.
      expect(vi.mocked(generateStructuredText).mock.calls[3]![0].prompt).toContain('Remove from the article')
    })

    it('stays held when the "removal" would add words', async () => {
      vi.stubGlobal('reportCaughtError', vi.fn())
      vi.mocked(generateStructuredText)
        .mockResolvedValueOnce(response(rejected, 10) as never)
        .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
        .mockResolvedValueOnce(added as never)
        .mockResolvedValueOnce(removal('up to 7 million', 'several million') as never)
      const generation = await streamArticle('site', 'Write a report', { research: false })

      expect((await generation.review(draft)).content).toBe(revision.content)
      expect(generation.editorialReview).toMatchObject({
        approved: false,
        issues: [{ code: 'invented_detail', blocking: true }],
        resolvedIssues: rejected.issues,
      })
      expect(generateStructuredText).toHaveBeenCalledTimes(4)
    })
  })

  it('keeps a deletion that cleared one finding while another still holds the article', async () => {
    vi.stubGlobal('reportCaughtError', vi.fn())
    const revision = { ...draft, content: '<p>The office approves it in 30 days.</p><p>Bring the drawing.</p>' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(
        response(
          {
            findings: [{ id: 1, resolved: false, reason: 'The claim is reworded, not removed.' }],
            introduced: [{ note: 'Remove "in 30 days"; no source.' }],
          },
          5,
        ) as never,
      )
      .mockResolvedValueOnce(
        response(
          {
            ...asEdits({}),
            edits: [{ find: '<p>The office approves it in 30 days.</p>', replace: '', insertAfter: false }],
          },
          3,
        ) as never,
      )
      .mockResolvedValueOnce(
        response(
          {
            findings: [
              { id: 1, resolved: true, reason: '' },
              { id: 2, resolved: false, reason: 'Still claims characters return.' },
            ],
            introduced: [],
          },
          2,
        ) as never,
      )
    const generation = await streamArticle('site', 'Write a report', { research: false })

    expect((await generation.review(draft)).content).toBe('<p>Bring the drawing.</p>')
    expect(generation.editorialReview).toMatchObject({
      approved: false,
      removalPass: true,
      issues: [{ code: 'unsupported_claim', blocking: true }],
    })
    expect(generation.editorialReview?.issues).toHaveLength(1)
  })

  it('revises with targeted edits when the only stance note is not blocking', async () => {
    const review = {
      issues: [
        { code: 'assignment_mismatch', note: 'The tone could be a little sharper.', blocking: false },
        ...rejected.issues,
      ],
    }
    const revision = { ...draft, content: '<p>A corrected draft.</p>' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(review, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(
        response({ findings: [{ id: 2, resolved: true, reason: '' }], introduced: [] }, 5) as never,
      )
    const generation = await streamArticle('site', 'Write a report', { research: false })

    expect((await generation.review(draft)).content).toBe(revision.content)
    expect(generation.editorialReview).toMatchObject({ approved: true, revisionMode: 'edits' })
    expect(vi.mocked(generateStructuredText).mock.calls[1]![0].prompt).not.toContain('complete replacement object')
  })

  it('falls back to a full rewrite when an edit quotes text that is not in the draft', async () => {
    const rewrite = { ...draft, title: 'Rewritten after a failed edit' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(
        response(
          { ...asEdits({}), edits: [{ find: 'Not in the draft', replace: 'x', insertAfter: false }] },
          4,
        ) as never,
      )
      .mockResolvedValueOnce(response(rewrite, 20) as never)
      .mockResolvedValueOnce(response(fixed, 5) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })

    expect((await generation.review(draft)).title).toBe(rewrite.title)
    expect(generation.editorialReview).toMatchObject({ approved: true, revisionMode: 'rewrite' })
    expect(vi.mocked(generateStructuredText).mock.calls[2]![0].prompt).toContain('complete replacement object')
    expect(vi.mocked(generateStructuredText).mock.calls[2]![0].providerOptions).toEqual(
      vi.mocked(streamText).mock.calls.at(-1)![0].providerOptions,
    )
    // The recheck of a rewrite compares both drafts; an edit list would send only the changes.
    expect(vi.mocked(generateStructuredText).mock.calls[3]![0].prompt).toContain('originalDraft')
  })

  it('rechecks an edit list against the changed passages only', async () => {
    const revision = { ...draft, content: '<h2>Ciri</h2><p>A corrected draft.</p>' }
    vi.mocked(generateStructuredText)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(asEdits(revision), 20) as never)
      .mockResolvedValueOnce(response(fixed, 5) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })

    await generation.review(draft)
    const recheck = JSON.parse(vi.mocked(generateStructuredText).mock.calls[2]![0].prompt as string)
    expect(recheck.changes).toEqual([{ before: draft.content, after: revision.content }])
    expect(recheck).not.toHaveProperty('originalDraft')
    // Edits think at medium effort; the writer and a full rewrite keep the quality tier's effort.
    const { aiReasoning } = await import('../../../server/utils/ai/reasoning')
    expect(vi.mocked(generateStructuredText).mock.calls[1]![0].providerOptions).toEqual(aiReasoning('medium'))
  })

  it('holds without a paid revision when only the verification failed', async () => {
    const source = 'https://example.test/positions'
    vi.stubGlobal('aiWebSearchTool', () => ({}))
    vi.mocked(generatePlainText)
      .mockResolvedValueOnce({
        text: `The organizations describe different policies. ${source}`,
        sources: [{ sourceType: 'url', url: source }],
        usage: { totalTokens: 4 },
      } as never)
      .mockResolvedValue({ text: '', sources: [], usage: { totalTokens: 7 }, finishReason: 'length' } as never)
    const generation = await streamArticle('site', 'Compare decision-making', { format: 'comparison', modules: [] })

    expect((await generation.review({ ...draft, sources: [source] })).content).toBe(draft.content)
    expect(generateStructuredText).not.toHaveBeenCalled()
    expect(generation.editorialReview).toMatchObject({
      approved: false,
      revised: false,
      issues: [{ key: 'verificationIncomplete', blocking: true }],
    })
  })

  it('does not rewrite an approved draft', async () => {
    vi.mocked(generateStructuredText).mockResolvedValueOnce(response(approved, 10) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toBe(draft)
    expect(generateStructuredText).toHaveBeenCalledTimes(1)
    expect(generation.editorialTokens).toBe(10)
  })
})

beforeEach(stubImports)
