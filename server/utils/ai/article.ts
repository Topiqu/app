import type { Language } from '~~/generated/zenstack/models'
import type { GenerationReviewStage } from '~~/shared/utils/articleGeneration'

import { generateText, Output, streamText } from 'ai'

export const generateArticle = async (
  clientSiteId: string,
  prompt: string,
  opts?: {
    research?: ResearchOption
    format?: ArticleFormat
    variant?: ArticleStructureVariant | null
    modules?: readonly ArticleModule[]
    researchDepth?: ResearchDepth
    fallbackWithoutResearch?: boolean
    allowGeneratedImages?: boolean
    editorialReview?: boolean
    knowledgeQuery?: string | null
    requireClearRights?: boolean
    audit?: ArticleGenerationAudit
    articleQuality?: ArticleQuality
    /** Language of review notes a person reads in the editor. */
    noteLanguage?: Language
  },
) => {
  const {
    config,
    language,
    researchTokens,
    researchBrief,
    knowledgeBrief,
    editorialDirection,
    citationAllowlist,
    knowledge,
    research,
    allowGeneratedImages,
    officialMediaPages,
  } = await buildArticleConfig(clientSiteId, prompt, opts)
  let groundingBrief = citationAllowlist
  const audit = opts?.audit
  const first = await auditArticleStep(
    audit,
    'writing',
    () => generateText(config),
    (result) => ({
      tokens: result.usage.totalTokens ?? 0,
      contentLength: result.output.content.length,
    }),
  )
  let object = first.output
  let editorialTokens = 0
  let editorialReview: EditorialOutcome | null = null

  if (opts?.editorialReview) {
    try {
      const pass = await editorialPass(object, {
        clientSiteId,
        prompt,
        config,
        groundingBrief,
        audit,
        context: {
          prompt,
          researchBrief,
          knowledgeBrief,
          editorialDirection,
          format: opts.format,
          modules: opts.modules,
          verifyFacts: opts.research !== false,
          noteLanguage: opts.noteLanguage,
        },
      })
      object = pass.draft
      groundingBrief = pass.groundingBrief
      editorialTokens = pass.tokens
      editorialReview = pass.review
    } catch (error) {
      await reportCaughtError('Article editorial review failed', error, { clientSiteId })
      editorialReview = {
        approved: false,
        revised: false,
        checkedAfterRevision: false,
        issues: [
          {
            code: 'broken_structure',
            note: 'The automated editorial review did not complete.',
            key: 'reviewUnavailable',
            blocking: true,
          },
        ],
      }
      await audit?.record('ARTICLE_GENERATION_FALLBACK', {
        stage: 'review',
        reason: 'review_unavailable',
        outcome: 'draft',
      })
    }
  } else await audit?.skip('review', 'disabled')

  object.sources = filterResearchSources(object.sources, groundingBrief)
  const finalized = await auditArticleStep(
    audit,
    'media',
    () =>
      finalizeArticle(applyFormat(object, opts?.format, opts?.modules), language, {
        allowGeneratedImages,
        officialMediaPages,
        clientSiteId,
        requireClearRights: opts?.requireClearRights,
        audit,
      }),
    (result) => ({
      cover: Boolean(result.articleImageUrl),
      bodyImages: (result.content.match(/<img\b/gi) ?? []).length,
    }),
  )
  const linked = await linkArticle(clientSiteId, finalized, language, { audit })

  return {
    ...finalized,
    content: linked.content,
    usage: first.usage,
    researchTokens,
    research,
    knowledge,
    editorialTokens,
    linkTokens: linked.tokens,
    editorialReview,
  }
}

type EditorialOutcome = EditorialReview & {
  revised: boolean
  /** False when the revised text was not checked again; the article is then held. */
  checkedAfterRevision: boolean
  resolvedIssues?: ReviewIssue[]
  verification?: string[]
  /** How the revision was made: an edit list, a full rewrite, plus a delete-only second pass. */
  revisionMode?: 'edits' | 'rewrite'
  removalPass?: boolean
}

type EditorialPassInput = {
  clientSiteId: string
  prompt: string
  config: Awaited<ReturnType<typeof buildArticleConfig>>['config']
  groundingBrief: string | null
  context: ReviewContext
  audit?: ArticleGenerationAudit
  abortSignal?: AbortSignal
}

const withTimeout = (signal: AbortSignal | undefined, ms: number) =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms)

/**
 * The revision: an edit list by default, a full rewrite only when the whole piece must change (a reversed
 * stance) or the edits cannot be applied. `changes` is set for edits, so the recheck reads only new text.
 */
const reviseDraft = async (
  draft: ArticleObject,
  review: EditorialReview,
  verificationBrief: string | null,
  groundingBrief: string | null,
  input: EditorialPassInput,
) => {
  const { audit, config } = input
  const instructions =
    config.instructions +
    '\nIndependent verification supersedes conflicting original research:\n' +
    (revisionEvidence(verificationBrief) ?? '')
  let tokens = 0
  if (!review.issues.some((issue) => issue.code === 'assignment_mismatch')) {
    const edited = await auditArticleStep(
      audit,
      'revision',
      () =>
        generateText({
          ...config,
          instructions,
          prompt: buildEditPrompt(input.prompt, draft, review, verificationBrief),
          // Targeted edits need less thinking than writing; reasoning bills as output, at $10/MTok on Sol.
          providerOptions: aiReasoning('medium'),
          output: Output.object({ schema: revisionEditsSchema }),
          abortSignal: withTimeout(input.abortSignal, REVISION_TIMEOUT_MS),
        }),
      (result) => ({ mode: 'edits', edits: result.output.edits.length, tokens: result.usage.totalTokens ?? 0 }),
    )
    tokens += edited.usage.totalTokens ?? 0
    const applied = applyRevisionEdits(draft, edited.output)
    if (applied.ok) return { draft: applied.draft, changes: applied.changes, mode: 'edits' as const, tokens }
    await audit?.record('ARTICLE_GENERATION_FALLBACK', {
      stage: 'revision',
      reason: `revision_edits_${applied.reason}`,
      outcome: 'rewrite',
    })
  }
  const rewritten = await auditArticleStep(
    audit,
    'revision',
    () =>
      generateText({
        ...config,
        instructions,
        prompt: buildRevisionPrompt(input.prompt, draft, review, verificationBrief),
        abortSignal: withTimeout(input.abortSignal, REVISION_TIMEOUT_MS),
      }),
    (result) => ({ mode: 'rewrite', tokens: result.usage.totalTokens ?? 0 }),
  )
  tokens += rewritten.usage.totalTokens ?? 0
  rewritten.output.sources = filterResearchSources(rewritten.output.sources, groundingBrief)
  return { draft: rewritten.output, changes: undefined, mode: 'rewrite' as const, tokens }
}

/**
 * One editorial pass for the editor and the autopilot: review, revise with every finding, confirm the
 * revision fixed them, and if only removable specifics still block, delete them. Only a blocking finding
 * left after that holds the article.
 */
const editorialPass = async (draft: ArticleObject, input: EditorialPassInput) => {
  const { audit, context, abortSignal } = input
  const first = await auditArticleStep(
    audit,
    'review',
    () => reviewArticle(draft, context),
    (result) => ({
      approved: result.review.approved,
      issueCodes: result.review.issues.map((issue) => issue.code),
      blockingCodes: result.review.issues.filter((issue) => issue.blocking).map((issue) => issue.code),
      tokens: result.usage.totalTokens ?? 0,
    }),
    { pass: 1 },
  )
  const groundingBrief = [input.groundingBrief, first.verificationBrief].filter(Boolean).join('\n') || null
  const verification = first.verdicts ? [first.verdicts] : []
  let tokens = first.usage.totalTokens ?? 0
  const unrevised = (): EditorialOutcome => ({
    ...first.review,
    revised: false,
    checkedAfterRevision: true,
    verification,
  })
  // Rewriting cannot finish a verification, so that finding alone is no reason to pay for a revision.
  const edits = first.review.issues.filter((issue) => issue.key !== 'verificationIncomplete')
  if (!edits.length) return { draft, review: unrevised(), groundingBrief, tokens }
  const recheckContext = { ...context, researchBrief: groundingBrief }
  const recheck = (
    revised: ArticleObject,
    original: ArticleObject,
    issues: ReviewIssue[],
    changes?: RevisionChange[],
    pass = 2,
  ) =>
    auditArticleStep(
      audit,
      'review',
      () => recheckRevision(revised, original, issues, recheckContext, changes),
      (result) => ({
        approved: result.review.approved,
        issueCodes: result.review.issues.map((issue) => issue.code),
        blockingCodes: result.review.issues.filter((issue) => issue.blocking).map((issue) => issue.code),
        resolved: result.resolvedIssues.length,
        tokens: result.usage.totalTokens ?? 0,
      }),
      { pass },
    )

  let revised: ArticleObject | null = null
  try {
    context.onProgress?.('revising')
    const revision = await reviseDraft(
      draft,
      { ...first.review, issues: edits },
      first.verificationBrief,
      groundingBrief,
      input,
    )
    tokens += revision.tokens
    revised = revision.draft
    const checked = await recheck(revision.draft, draft, first.review.issues, revision.changes)
    tokens += checked.usage.totalTokens ?? 0
    let review: EditorialOutcome = {
      ...checked.review,
      revised: true,
      checkedAfterRevision: true,
      resolvedIssues: checked.resolvedIssues,
      verification,
      revisionMode: revision.mode,
    }

    const blocking = checked.review.issues.filter((issue) => issue.blocking)
    if (blocking.length && blocking.every(isRemovable)) {
      const base = revision.draft
      try {
        context.onProgress?.('revising')
        const removal = await auditArticleStep(
          audit,
          'revision',
          () =>
            generateText({
              model: aiModel('articleEditor'),
              maxOutputTokens: 4000,
              providerOptions: aiReasoning('medium'),
              prompt: buildRemovalPrompt(base, blocking),
              output: Output.object({ schema: revisionEditsSchema }),
              abortSignal: withTimeout(abortSignal, 120_000),
            }),
          (result) => ({ mode: 'removal', edits: result.output.edits.length, tokens: result.usage.totalTokens ?? 0 }),
        )
        tokens += removal.usage.totalTokens ?? 0
        // Code, not the model, guarantees the pass only deleted, so it cannot add a new error.
        const applied = applyRevisionEdits(base, removal.output, { removalOnly: true })
        if (applied.ok) {
          const second = await recheck(applied.draft, base, blocking, applied.changes, 3)
          tokens += second.usage.totalTokens ?? 0
          if (second.review.approved) {
            const tips = checked.review.issues.filter((issue) => !issue.blocking)
            const issues = [...second.review.issues, ...tips].slice(0, 6)
            revised = applied.draft
            review = {
              ...review,
              issues,
              approved: !issues.some((issue) => issue.blocking),
              resolvedIssues: [...checked.resolvedIssues, ...second.resolvedIssues],
              removalPass: true,
            }
          }
        } else
          await audit?.record('ARTICLE_GENERATION_FALLBACK', {
            stage: 'revision',
            reason: `removal_${applied.reason}`,
            outcome: 'held',
          })
      } catch (error) {
        if (abortSignal?.aborted) throw error
        await reportCaughtError('Removal pass failed; keeping the checked revision', error, {
          clientSiteId: input.clientSiteId,
        })
      }
    }
    return { draft: revised, review, groundingBrief, tokens }
  } catch (error) {
    if (abortSignal?.aborted) throw error
    await audit?.record('ARTICLE_GENERATION_FALLBACK', {
      stage: audit.stageForError(error) ?? 'revision',
      reason: 'revision_or_review_unavailable',
      outcome: 'available_draft',
    })
    await reportCaughtError('Article revision or its check failed; returning the available draft', error, {
      clientSiteId: input.clientSiteId,
    })
    // Only edits were pending, so the reviewed original is publishable as it stands.
    if (first.review.approved || !revised) return { draft, review: unrevised(), groundingBrief, tokens }
    // The revision probably fixed the blockers, but nothing confirmed it: keep it and hold the article.
    const review: EditorialOutcome = {
      approved: false,
      revised: true,
      checkedAfterRevision: false,
      issues: [
        {
          code: 'broken_structure',
          note: 'The revised draft could not be checked. Review it before publishing.',
          key: 'uncheckedRevision',
          blocking: true,
        },
      ],
      verification,
    }
    return { draft: revised, review, groundingBrief, tokens }
  }
}

// A revision rewrites the whole article, so it needs about as long as the draft; 90 s left no margin.
const REVISION_TIMEOUT_MS = 300_000

export const streamArticle = async (
  clientSiteId: string,
  prompt: string,
  opts: {
    abortSignal?: AbortSignal
    research?: ResearchOption
    researchDepth?: ResearchDepth
    fallbackWithoutResearch?: boolean
    allowGeneratedImages?: boolean
    useKnowledge?: boolean
    language?: Language
    /** The editor's interface language, for review notes. */
    noteLanguage?: Language
    format?: ArticleFormat
    modules?: readonly ArticleModule[]
    /** The article being regenerated, so it is never offered as its own link target. */
    articleId?: string | null
    audit?: ArticleGenerationAudit
    articleQuality?: ArticleQuality
  } = {},
) => {
  const audit = opts.audit
  const {
    config,
    language,
    researchTokens,
    researchBrief,
    knowledgeBrief,
    editorialDirection,
    citationAllowlist,
    knowledge,
    researchSources,
    research,
    allowGeneratedImages,
    officialMediaPages,
  } = await buildArticleConfig(clientSiteId, prompt, {
    ...opts,
    knowledgeQuery: opts.useKnowledge === false ? null : prompt,
    illustrative: true,
  })
  let groundingBrief = citationAllowlist
  const result = streamText({ ...config, abortSignal: opts.abortSignal })

  let linkTokens = 0
  // Caption labels follow the requested article language, including a selected translation tab.
  const finalize = async (object: ArticleObject, callbacks?: FinalizeCallbacks) => {
    const finalized = await auditArticleStep(
      audit,
      'media',
      () =>
        finalizeArticle(
          applyFormat(
            { ...object, sources: filterResearchSources(object.sources, groundingBrief) },
            opts.format,
            opts.modules,
          ),
          language,
          {
            ...callbacks,
            allowGeneratedImages,
            officialMediaPages,
            clientSiteId,
            audit,
            illustrative: opts.format === 'story',
          },
        ),
      (result) => ({
        cover: Boolean(result.articleImageUrl),
        bodyImages: (result.content.match(/<img\b/gi) ?? []).length,
      }),
    )
    const linked = await linkArticle(clientSiteId, finalized, language, {
      excludeId: opts.articleId,
      abortSignal: callbacks?.abortSignal ?? opts.abortSignal,
      audit,
    })
    linkTokens += linked.tokens
    return { ...finalized, content: linked.content }
  }

  let editorialTokens = 0
  let editorialReview: EditorialOutcome | null = null
  const review = async (draft: ArticleObject, onProgress?: (stage: GenerationReviewStage) => void) => {
    draft.sources = filterResearchSources(draft.sources, groundingBrief)
    const pass = await editorialPass(draft, {
      clientSiteId,
      prompt,
      config,
      groundingBrief,
      audit,
      abortSignal: opts.abortSignal,
      context: {
        prompt,
        researchBrief,
        knowledgeBrief,
        editorialDirection,
        format: opts.format,
        modules: opts.modules,
        abortSignal: opts.abortSignal,
        verifyFacts: opts.research !== false,
        illustrative: true,
        noteLanguage: opts.noteLanguage,
        onProgress,
      },
    })
    groundingBrief = pass.groundingBrief
    editorialTokens += pass.tokens
    editorialReview = pass.review
    return pass.draft
  }
  return {
    result,
    finalize,
    review,
    researchTokens,
    researchSources,
    research,
    knowledge,
    get editorialTokens() {
      return editorialTokens
    },
    get linkTokens() {
      return linkTokens
    },
    get editorialReview() {
      return editorialReview
    },
  }
}
