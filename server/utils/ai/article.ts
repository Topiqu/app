import type { Language } from '~~/generated/zenstack/models'
import type { GenerationReviewStage } from '~~/shared/utils/articleGeneration'

import { generateText, streamText } from 'ai'

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
}

/**
 * One editorial pass for the editor and the autopilot: review, revise with every finding, then confirm
 * the revision fixed them. Only a blocking finding left over holds the article.
 */
const editorialPass = async (
  draft: ArticleObject,
  input: {
    clientSiteId: string
    prompt: string
    config: Awaited<ReturnType<typeof buildArticleConfig>>['config']
    groundingBrief: string | null
    context: ReviewContext
    audit?: ArticleGenerationAudit
    abortSignal?: AbortSignal
  },
) => {
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

  let revised: ArticleObject | null = null
  try {
    context.onProgress?.('revising')
    const revision = await auditArticleStep(
      audit,
      'revision',
      () =>
        generateText({
          ...input.config,
          instructions:
            input.config.instructions +
            '\nIndependent verification supersedes conflicting original research:\n' +
            (revisionEvidence(first.verificationBrief) ?? ''),
          prompt: buildRevisionPrompt(input.prompt, draft, { ...first.review, issues: edits }, first.verificationBrief),
          abortSignal: abortSignal
            ? AbortSignal.any([abortSignal, AbortSignal.timeout(REVISION_TIMEOUT_MS)])
            : AbortSignal.timeout(REVISION_TIMEOUT_MS),
        }),
      (result) => ({ tokens: result.usage.totalTokens ?? 0 }),
    )
    tokens += revision.usage.totalTokens ?? 0
    revision.output.sources = filterResearchSources(revision.output.sources, groundingBrief)
    const output = revision.output
    revised = output
    // No second web verification: each live pass samples different claims, so a revision never converges.
    const checked = await auditArticleStep(
      audit,
      'review',
      () => recheckRevision(output, draft, first.review.issues, { ...context, researchBrief: groundingBrief }),
      (result) => ({
        approved: result.review.approved,
        issueCodes: result.review.issues.map((issue) => issue.code),
        blockingCodes: result.review.issues.filter((issue) => issue.blocking).map((issue) => issue.code),
        resolved: result.resolvedIssues.length,
        tokens: result.usage.totalTokens ?? 0,
      }),
      { pass: 2 },
    )
    tokens += checked.usage.totalTokens ?? 0
    const review: EditorialOutcome = {
      ...checked.review,
      revised: true,
      checkedAfterRevision: true,
      resolvedIssues: checked.resolvedIssues,
      verification,
    }
    return { draft: output, review, groundingBrief, tokens }
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
