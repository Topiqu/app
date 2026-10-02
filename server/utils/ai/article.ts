import type { Language } from '~~/generated/zenstack/models'
import type { ResearchDepth } from '~~/shared/utils/articleGeneration'

import { generateText, streamText } from 'ai'

import type { FinalizeCallbacks } from './articleMedia'
import type { ArticleObject, ResearchOption } from './articleConfig'
import type { ArticleFormat, ArticleModule, ArticleStructureVariant } from './formats'

import { applyFormat } from './formats'
import { finalizeArticle } from './articleMedia'
import { buildArticleConfig } from './articleConfig'
import { filterResearchSources } from './researchEvidence'
import { buildRevisionPrompt, reviewArticle, revisionEvidence, type EditorialReview } from './articleQuality'

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
  const first = await generateText(config)
  let object = first.output
  let editorialTokens = 0
  let editorialReview: (EditorialReview & { revised: boolean; verification?: string[] }) | null = null

  if (opts?.editorialReview) {
    const verification: string[] = []
    try {
      const context = {
        prompt,
        researchBrief,
        knowledgeBrief,
        editorialDirection,
        format: opts.format,
        modules: opts.modules,
        verifyFacts: opts.research !== false,
      }
      const initial = await reviewArticle(object, context)
      if (initial.verificationBrief)
        groundingBrief = [groundingBrief, initial.verificationBrief].filter(Boolean).join('\n')
      editorialTokens += initial.usage.totalTokens ?? 0
      if (initial.verdicts) verification.push(initial.verdicts)
      editorialReview = { ...initial.review, revised: false, verification }

      if (!initial.review.approved) {
        const revision = await generateText({
          ...config,
          instructions:
            config.instructions +
            '\nIndependent verification supersedes conflicting original research:\n' +
            (revisionEvidence(initial.verificationBrief) ?? ''),
          prompt: buildRevisionPrompt(prompt, object, initial.review, initial.verificationBrief),
        })
        editorialTokens += revision.usage.totalTokens ?? 0
        object = revision.output

        const checked = await reviewArticle(object, context)
        if (checked.verificationBrief)
          groundingBrief = [groundingBrief, checked.verificationBrief].filter(Boolean).join('\n')
        editorialTokens += checked.usage.totalTokens ?? 0
        if (checked.verdicts) verification.push(checked.verdicts)
        editorialReview = { ...checked.review, revised: true, verification }
      }
    } catch (error) {
      await reportCaughtError('Article editorial review failed', error, { clientSiteId })
      editorialReview = {
        approved: false,
        revised: false,
        issues: [{ code: 'broken_structure', note: 'The automated editorial review did not complete.' }],
      }
    }
  }

  object.sources = filterResearchSources(object.sources, groundingBrief)
  const finalized = await finalizeArticle(applyFormat(object, opts?.format, opts?.modules), language, {
    allowGeneratedImages,
    officialMediaPages,
    clientSiteId,
  })

  return { ...finalized, usage: first.usage, researchTokens, research, knowledge, editorialTokens, editorialReview }
}

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
    format?: ArticleFormat
    modules?: readonly ArticleModule[]
  } = {},
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

  // Caption labels follow the requested article language, including a selected translation tab.
  const finalize = (object: ArticleObject, callbacks?: FinalizeCallbacks) =>
    finalizeArticle(
      applyFormat(
        { ...object, sources: filterResearchSources(object.sources, groundingBrief) },
        opts.format,
        opts.modules,
      ),
      language,
      { ...callbacks, allowGeneratedImages, officialMediaPages, clientSiteId },
    )

  let editorialTokens = 0
  let editorialReview:
    | (EditorialReview & {
        revised: boolean
        checkedAfterRevision: boolean
        resolvedIssues?: EditorialReview['issues']
        verification?: string[]
      })
    | null = null
  const review = async (draft: ArticleObject) => {
    const context = {
      prompt,
      researchBrief,
      knowledgeBrief,
      editorialDirection,
      format: opts.format,
      modules: opts.modules,
      abortSignal: opts.abortSignal,
      verifyFacts: opts.research !== false,
      illustrative: true,
    }
    draft.sources = filterResearchSources(draft.sources, groundingBrief)
    const first = await reviewArticle(draft, context)
    if (first.verificationBrief) groundingBrief = [groundingBrief, first.verificationBrief].filter(Boolean).join('\n')
    editorialTokens += first.usage.totalTokens ?? 0
    const verification = first.verdicts ? [first.verdicts] : []
    editorialReview = { ...first.review, revised: false, checkedAfterRevision: true, verification }
    if (first.review.approved) return draft
    let revisedDraft = draft
    try {
      const revision = await generateText({
        ...config,
        instructions:
          config.instructions +
          '\nIndependent verification supersedes conflicting original research:\n' +
          (revisionEvidence(first.verificationBrief) ?? ''),
        prompt: buildRevisionPrompt(prompt, draft, first.review, first.verificationBrief),
        abortSignal: opts.abortSignal
          ? AbortSignal.any([opts.abortSignal, AbortSignal.timeout(90_000)])
          : AbortSignal.timeout(90_000),
      })
      editorialTokens += revision.usage.totalTokens ?? 0
      revision.output.sources = filterResearchSources(revision.output.sources, groundingBrief)
      revisedDraft = revision.output
      // A completed rewrite is not an approval. Keep its status honest if the follow-up fails.
      editorialReview = { ...first.review, revised: true, checkedAfterRevision: false, verification }
      // Recheck substance and the supplied factual premises without another full web-search pass.
      const checked = await reviewArticle(revisedDraft, {
        ...context,
        researchBrief: groundingBrief,
        verifyFacts: false,
        factsChecked: !!first.verificationBrief,
      })
      editorialTokens += checked.usage.totalTokens ?? 0
      editorialReview = {
        ...checked.review,
        revised: true,
        checkedAfterRevision: true,
        resolvedIssues: checked.review.approved ? first.review.issues : [],
        verification,
      }
      return revisedDraft
    } catch (error) {
      if (opts.abortSignal?.aborted) throw error
      if (editorialReview.revised)
        editorialReview = {
          ...editorialReview,
          approved: false,
          issues: [
            { code: 'broken_structure', note: 'The revised draft could not be checked. Review it before publishing.' },
          ],
        }
      await reportCaughtError('Manual article revision or follow-up review failed; returning available draft', error, {
        clientSiteId,
      })
      return revisedDraft
    }
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
    get editorialReview() {
      return editorialReview
    },
  }
}
