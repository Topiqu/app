import { promptIntent } from '~~/shared/utils/aiVisibility'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  const clientSiteId = user.clientSiteId!
  const site = await db.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { focus: true, audience: true, language: true },
  })
  const metrics = await db.searchConsoleMetric.findMany({
    where: { clientSiteId, query: { not: '' } },
    select: { query: true },
    orderBy: { impressions: 'desc' },
    distinct: ['query'],
    take: 5,
  })
  const focus = site.focus?.trim()
  const audience = site.audience?.trim()
  const generated =
    site.language === 'cs'
      ? [
          focus && `Jak vybrat nejlepší řešení pro ${focus}?`,
          focus && `Jaké jsou nejlepší alternativy pro ${focus}?`,
          focus && audience && `Co by měla cílová skupina ${audience} vědět o ${focus}?`,
        ]
      : [
          focus && `How do you choose the best solution for ${focus}?`,
          focus && `What are the best alternatives for ${focus}?`,
          focus && audience && `What should ${audience} know about ${focus}?`,
        ]
  const suggestions = [...new Set([...generated.filter(Boolean), ...metrics.map((row) => row.query.trim())])].slice(
    0,
    8,
  ) as string[]
  if (!suggestions.length) return { created: 0 }

  const result = await db.aiVisibilityPrompt.createMany({
    data: suggestions.map((text) => ({
      clientSiteId,
      text,
      language: site.language,
      intent: promptIntent(text),
      source: metrics.some((row) => row.query.trim() === text) ? ('SEARCH_CONSOLE' as const) : ('GENERATED' as const),
    })),
    skipDuplicates: true,
  })
  await logAction({
    action: 'AI_VISIBILITY_PROMPTS_SUGGESTED',
    userId: user.id,
    clientSiteId,
    metadata: { created: result.count },
  })
  return { created: result.count }
})
