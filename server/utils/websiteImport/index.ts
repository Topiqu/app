import { randomUUID } from 'node:crypto'

export const WEBSITE_SITE_SELECT = {
  accentColor: true,
  logoUrl: true,
  faviconUrl: true,
  keywords: true,
  focus: true,
  audience: true,
  aiToneOfVoice: true,
  language: true,
  socials: { select: { platform: true, url: true } },
} as const

const audit = async (action: string, clientSiteId: string, id: string, metadata: Record<string, unknown> = {}) => {
  try {
    await logAction({ action, clientSiteId, metadata: { importId: id, ...metadata } })
  } catch {
    await reportCaughtError('Website import audit failed', new Error('WEBSITE_AUDIT_FAILED'), { importId: id, action })
  }
}

const reserveBudget = async (id: string, token: string, continuing = false) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('website-import-daily-budget'))`
    const job = await tx.websiteImport.findFirst({ where: { id, leaseToken: token, status: 'PROCESSING' } })
    if (!job || (job.searchStartedAt && !continuing)) return 'unavailable' as const
    const configured = Number(useRuntimeConfig().websiteImport.dailyBudgetUsd)
    const limit = Number.isFinite(configured) && configured >= 0 ? Math.round(configured * 1_000_000) : 0
    const day = new Date()
    day.setUTCHours(0, 0, 0, 0)
    if (continuing && job.budgetDay?.getTime() === day.getTime()) return 'reserved' as const
    const aggregate = await tx.websiteImport.aggregate({ where: { budgetDay: day }, _sum: { budgetCostMicros: true } })
    if ((aggregate._sum.budgetCostMicros ?? 0) + WEBSITE_IMPORT_LIMITS.reservationMicros > limit) {
      await tx.websiteImport.updateMany({
        where: { id, leaseToken: token },
        data: {
          status: 'PENDING',
          attempts: { decrement: 1 },
          leaseToken: null,
          leaseUntil: new Date(Date.now() + 60_000),
          errorCode: 'DAILY_BUDGET',
        },
      })
      return 'deferred' as const
    }
    await tx.websiteImport.updateMany({
      where: { id, leaseToken: token },
      data: {
        budgetDay: day,
        reservedCostMicros: WEBSITE_IMPORT_LIMITS.reservationMicros,
        budgetCostMicros: WEBSITE_IMPORT_LIMITS.reservationMicros,
        ...(!continuing ? { searchStartedAt: new Date() } : {}),
      },
    })
    return 'reserved' as const
  })

const storePage = async (
  job: { id: string; clientSiteId: string },
  token: string,
  url: string,
  page: Awaited<ReturnType<typeof extractKnowledgeUrl>>,
) => {
  if (
    !(await prisma.websiteImport.findFirst({
      where: { id: job.id, leaseToken: token, status: 'PROCESSING' },
      select: { id: true },
    }))
  )
    throw new Error('LEASE_LOST')
  try {
    const stored = await createKnowledgeSource(
      prisma,
      {
        clientSiteId: job.clientSiteId,
        websiteImportId: job.id,
        kind: 'URL',
        sourceUrl: url,
        title: page.title?.slice(0, 200) || new URL(url).hostname,
        content: page.content,
        contentHash: hashKnowledge(page.content),
        mimeType: page.mimeType,
        fetchedAt: new Date(),
        validAsOf: page.validAsOf ?? null,
        useInArticles: false,
      },
      true,
    )
    return stored.reused ? 'duplicate' : 'created'
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'data' in error &&
      (error.data as { code?: string })?.code === 'KNOWLEDGE_QUOTA'
    )
      return 'quota'
    throw error
  }
}

export const processWebsiteImport = async (id: string) => {
  const token = randomUUID()
  const now = new Date()
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('website-import-claim'))`
    if ((await tx.websiteImport.count({ where: { status: 'PROCESSING', leaseUntil: { gt: now } } })) >= 3)
      return { count: 0 }
    return tx.websiteImport.updateMany({
      where: {
        id,
        deletedAt: null,
        attempts: { lt: 3 },
        OR: [
          { status: 'PENDING', OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
          { status: 'PROCESSING', leaseUntil: { lt: now } },
        ],
      },
      data: {
        status: 'PROCESSING',
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + WEBSITE_IMPORT_LIMITS.leaseMs),
        attempts: { increment: 1 },
        errorCode: null,
      },
    })
  })
  if (claim.count !== 1) return false
  const job = await prisma.websiteImport.findUniqueOrThrow({ where: { id } })
  const started = Date.now()
  try {
    const site = await prisma.clientSite.findFirst({
      where: { id: job.clientSiteId, deletedAt: null },
      select: { language: true, plan: true },
    })
    if (!site) throw new Error('AI_UNAVAILABLE')
    if (!hasAiPlan(site.plan)) {
      await prisma.websiteImport.updateMany({
        where: { id, leaseToken: token },
        data: {
          status: 'PENDING',
          attempts: { decrement: 1 },
          leaseToken: null,
          leaseUntil: new Date(Date.now() + 30 * 60_000),
          errorCode: 'AI_UNAVAILABLE',
        },
      })
      return false
    }
    await assertPublicHttpsUrl(job.sourceUrl)
    if (!useRuntimeConfig().anthropic.apiKey?.trim() && !process.env.ANTHROPIC_API_KEY?.trim())
      throw new Error('PROVIDER_UNAVAILABLE')
    if (job.searchStartedAt && !job.searchCompletedAt) throw new Error('SEARCH_OUTCOME_UNKNOWN')
    if (job.extractionStartedAt && !job.extractionCompletedAt) throw new Error('ANALYSIS_OUTCOME_UNKNOWN')
    const { researchWebsite, analyzeWebsite } = await import('./ai')
    await audit('WEBSITE_IMPORT_STARTED', job.clientSiteId, id, {
      attempt: job.attempts,
      searchLimit: WEBSITE_IMPORT_LIMITS.searches,
    })
    let research: Awaited<ReturnType<typeof researchWebsite>>
    if (job.searchCompletedAt && job.searchText !== null) {
      const urls = Array.isArray(job.searchSources)
        ? job.searchSources.filter(
            (value): value is string => typeof value === 'string' && isWebsitePage(value, job.sourceUrl),
          )
        : [job.sourceUrl]
      research = { text: job.searchText, urls, usage: null }
    } else {
      const budget = await reserveBudget(id, token)
      if (budget !== 'reserved') {
        if (budget === 'deferred')
          await audit('WEBSITE_IMPORT_BUDGET_DEFERRED', job.clientSiteId, id, { stage: 'search' })
        return false
      }
      research = await researchWebsite(id, job.clientSiteId, job.sourceUrl)
      const saved = await prisma.websiteImport.updateMany({
        where: { id, leaseToken: token, status: 'PROCESSING' },
        data: {
          searchCompletedAt: new Date(),
          searchText: research.text,
          searchSources: toDatabaseJson(research.urls),
          usage: toDatabaseJson({ search: research.usage }),
        },
      })
      if (saved.count !== 1) return false
    }
    const warnings = new Set<WebsiteImportResult['warnings'][number]>()
    const metadata = emptyWebsiteMetadata()
    const pages: { url: string; content: string }[] = []
    const sources: WebsiteImportResult['sources'] = []
    for (const url of research.urls.slice(0, WEBSITE_IMPORT_LIMITS.pages)) {
      try {
        let found = emptyWebsiteMetadata()
        const page = await extractKnowledgeUrl(url, {
          maxBytes: WEBSITE_IMPORT_LIMITS.pageBytes,
          maxCharacters: WEBSITE_IMPORT_LIMITS.pageCharacters,
          htmlOnly: true,
          allowUrl: (target) => isWebsitePage(target.href, job.sourceUrl),
          onHtml: (html) => {
            found = extractWebsiteMetadata(html, url)
          },
        })
        pages.push({ url, content: page.content.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[contact omitted]') })
        sources.push({ url, title: page.title?.slice(0, 200) || new URL(url).hostname })
        metadata.logoUrls = [...new Set([...metadata.logoUrls, ...found.logoUrls])].slice(0, 4)
        metadata.faviconUrls = [...new Set([...metadata.faviconUrls, ...found.faviconUrls])].slice(0, 4)
        metadata.colors = [...new Set([...metadata.colors, ...found.colors])].slice(0, 4)
        for (const social of found.socials)
          if (!metadata.socials.some((item) => item.platform === social.platform)) metadata.socials.push(social)
        if ((await storePage(job, token, url, page)) === 'quota') warnings.add('knowledgeQuota')
      } catch {
        warnings.add('pageFailed')
        await audit('WEBSITE_IMPORT_PAGE_FAILED', job.clientSiteId, id, { host: new URL(url).hostname })
      }
    }
    if (!pages.length && !research.text) throw new Error('NO_CONTENT')
    for (const [field, key] of [
      ['logoUrl', 'logoUrls'],
      ['faviconUrl', 'faviconUrls'],
    ] as const) {
      const candidates = metadata[key].filter((url) => !/\.svg(?:\?|$)/i.test(url)).slice(0, 2)
      metadata[key] = []
      for (const url of candidates) {
        try {
          const asset = await readWebsiteAsset(url, field)
          metadata[key].push(url)
          if (field === 'logoUrl' && !metadata.colors.length) metadata.colors = await suggestBrandColors(asset.bytes)
          break
        } catch {
          warnings.add('assetUnavailable')
        }
      }
    }
    const budget = await reserveBudget(id, token, true)
    if (budget !== 'reserved') {
      if (budget === 'deferred')
        await audit('WEBSITE_IMPORT_BUDGET_DEFERRED', job.clientSiteId, id, { stage: 'analysis' })
      return false
    }
    const currentLease = await prisma.websiteImport.updateMany({
      where: { id, leaseToken: token, status: 'PROCESSING', extractionStartedAt: null },
      data: { extractionStartedAt: new Date(), leaseUntil: new Date(Date.now() + WEBSITE_IMPORT_LIMITS.leaseMs) },
    })
    if (currentLease.count !== 1) return false
    let values = emptyWebsiteValues()
    let analysisUsage: Awaited<ReturnType<typeof analyzeWebsite>>['usage'] = null
    try {
      const analysis = await analyzeWebsite(id, job.clientSiteId, {
        language: site.language,
        research: research.text,
        pages,
        metadata,
      })
      values = analysis.values
      analysisUsage = analysis.usage
    } catch {
      warnings.add('analysisFailed')
      await reportCaughtError('Website settings analysis failed', new Error('WEBSITE_ANALYSIS_FAILED'), {
        importId: id,
      })
    }
    // Asset URLs and colors must have been observed in fetched HTML, never invented by the model.
    values.logoUrl = metadata.logoUrls.includes(values.logoUrl ?? '') ? values.logoUrl : (metadata.logoUrls[0] ?? null)
    values.faviconUrl = metadata.faviconUrls.includes(values.faviconUrl ?? '')
      ? values.faviconUrl
      : (metadata.faviconUrls.find((url) => /\.(?:png|webp|jpe?g)(?:\?|$)/i.test(url)) ?? null)
    values.accentColor = metadata.colors.includes(values.accentColor?.toUpperCase() ?? '')
      ? (values.accentColor?.toUpperCase() ?? null)
      : (metadata.colors[0] ?? null)
    values.socials = metadata.socials
    values.keywords = [
      ...new Map(values.keywords.map((keyword) => [keyword.trim().toLocaleLowerCase(), keyword.trim()])).values(),
    ].filter(Boolean)
    const result: WebsiteImportResult = { values, sources, warnings: [...warnings] }
    const knownUsage = research.usage && research.usage.searches !== null && analysisUsage
    const budgetCostMicros = knownUsage
      ? research.usage!.estimatedCostMicros + analysisUsage!.estimatedCostMicros + WEBSITE_IMPORT_LIMITS.indexingMicros
      : undefined
    const done = await prisma.websiteImport.updateMany({
      where: { id, leaseToken: token, status: 'PROCESSING' },
      data: {
        result: toDatabaseJson(result),
        status: 'READY',
        extractionCompletedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
        usage: toDatabaseJson({ search: research.usage, analysis: analysisUsage }),
        ...(budgetCostMicros === undefined ? {} : { budgetCostMicros }),
      },
    })
    if (done.count !== 1) return false
    await audit('WEBSITE_IMPORT_READY', job.clientSiteId, id, {
      durationMs: Date.now() - started,
      pages: pages.length,
      warnings: [...warnings],
      fields: Object.entries(values)
        .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null))
        .map(([key]) => key),
      searches: research.usage?.searches ?? null,
      estimatedCostMicros: budgetCostMicros ?? null,
    })
    return true
  } catch (error) {
    const safeCodes = [
      'AI_UNAVAILABLE',
      'PROVIDER_UNAVAILABLE',
      'SEARCH_OUTCOME_UNKNOWN',
      'ANALYSIS_OUTCOME_UNKNOWN',
      'NO_CONTENT',
    ]
    const code = error instanceof Error && safeCodes.includes(error.message) ? error.message : 'PROCESSING_FAILED'
    await prisma.websiteImport.updateMany({
      where: { id, leaseToken: token },
      data: { status: 'FAILED', errorCode: code, leaseToken: null, leaseUntil: null },
    })
    await audit('WEBSITE_IMPORT_FAILED', job.clientSiteId, id, { code, durationMs: Date.now() - started })
    await reportCaughtError('Website import failed', new Error(code), { importId: id, clientSiteId: job.clientSiteId })
    return false
  }
}

export const kickWebsiteImport = (id: string) => {
  void processWebsiteImport(id).catch(() =>
    reportCaughtError('Website import kick failed', new Error('WEBSITE_KICK_FAILED'), { importId: id }),
  )
}

export const drainWebsiteImports = async () => {
  const abandoned = await prisma.websiteImport.updateMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'PROCESSING'] },
      attempts: { gte: 3 },
      leaseUntil: { lt: new Date() },
    },
    data: { status: 'FAILED', errorCode: 'RETRY_LIMIT', leaseToken: null, leaseUntil: null },
  })
  const pending = await prisma.websiteImport.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'PROCESSING'] },
      attempts: { lt: 3 },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 3,
    select: { id: true },
  })
  let completed = 0
  for (const job of pending) if (await processWebsiteImport(job.id)) completed++
  const failed = pending.length
    ? await prisma.websiteImport.count({ where: { id: { in: pending.map((job) => job.id) }, status: 'FAILED' } })
    : 0
  return {
    checked: pending.length,
    completed,
    processed: completed,
    failed: abandoned.count + failed,
    skipped: pending.length - completed - failed,
  }
}
