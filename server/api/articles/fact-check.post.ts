import { z } from 'zod'
import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { runArticleFactCheck } from '~~/server/utils/ai/factCheck'
import { FACT_CHECK_LIMITS } from '~~/shared/utils/articleFactCheck'
import { inspectFactCheckSources } from '~~/server/utils/factCheckSources'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event, { minRole: 'admin', clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await ensureMinAccountAge(event, user.id)
  await requireAiPlan(user.clientSiteId, t('common.errors.featureNotInPlan')!)
  if (!useRuntimeConfig().openAi.apiKey)
    throw createError({
      statusCode: 503,
      message: 'AI service is not configured',
      data: { code: 'AI_NOT_CONFIGURED' },
    })

  const allowed = await consumeRateLimit(`fact-check:${user.clientSiteId}:${user.id}`, 10, 10 * 60)
  if (!allowed)
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests') || 'Too many requests' })

  const input = await readValidatedBody(
    event,
    z.object({
      title: z.string().trim().max(255),
      excerpt: z.string().max(1_000).nullable(),
      content: z.string().min(1).max(FACT_CHECK_LIMITS.maxArticleCharacters),
      sources: z.array(z.string().max(2_048)).max(FACT_CHECK_LIMITS.maxSources),
      language: z.enum(LANGUAGE_OPTIONS),
    }).parse,
  )
  const sources = input.sources.map((source) => source.trim()).filter(Boolean)
  const inspected = await inspectFactCheckSources(sources)

  let checked: Awaited<ReturnType<typeof runArticleFactCheck>>
  try {
    checked = await runArticleFactCheck({ ...input, sources }, inspected)
  } catch (error) {
    console.error('Article fact-check provider failed', error)
    throw createError({ statusCode: 503, message: 'AI service is temporarily unavailable' })
  }
  const { result, usage } = checked
  await recordAiUsage(
    user.clientSiteId,
    usage.totalTokens ?? 0,
    'ARTICLE_FACT_CHECK',
    { claimCount: result.counts.total, sourceCount: sources.length, usage },
    event,
    user.id,
  )
  return result
})
