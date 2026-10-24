import type { Language } from '~~/generated/zenstack/models'

type FinalizeImage = { slot: number; html: string }

// Library pictures looked at per search; past that the slot falls back as if nothing matched.
const IMAGE_CHECKS = 3

// Openverse labels `CC0` and `Public Domain Mark`, Commons `Public domain` or `PD-…`; none needs an author.
const PUBLIC_DOMAIN_LICENSE = /^(cc0|public domain|pd\b)/i

/** Only a CC licence counts as Creative Commons; anything unrecognised needs a person to confirm it. */
export const stockOrigin = (license?: string) => {
  const name = license?.trim() ?? ''
  if (PUBLIC_DOMAIN_LICENSE.test(name)) return 'PUBLIC_DOMAIN' as const
  // A tenant blog is commercial use, which NC licences forbid.
  return /^cc[\s-]/i.test(name) && !/\bnc\b/i.test(name) ? ('CREATIVE_COMMONS' as const) : ('EXTERNAL' as const)
}

/** The rights fields a found image registers with; the candidate filter judges the same record. */
const creditAsset = (credit?: ImageCredit, publisher = false) => {
  const origin = publisher ? ('PUBLISHER' as const) : stockOrigin(credit?.license)
  return {
    origin,
    sourceUrl: credit?.sourceUrl,
    author: credit?.author,
    license: credit?.license,
    licenseUrl: credit?.licenseUrl,
    attribution: credit ? [credit.author, credit.license, credit.source].filter(Boolean).join(' · ') : null,
    attributionRequired: origin === 'CREATIVE_COMMONS',
  }
}

const coverIllustrationPrompt = (subject: string) =>
  `Atmospheric editorial illustration evoking ${subject}. No people, faces, logos, text or depiction of a specific real event.`
export type FinalizeCallbacks = {
  audit?: import('../articleGenerationAudit').ArticleGenerationAudit
  onImage?: (image: FinalizeImage) => void
  onMedia?: (progress: ArticleMediaProgress) => void
  abortSignal?: AbortSignal
  allowGeneratedImages?: boolean
  officialMediaPages?: readonly string[]
  clientSiteId?: string
  /** Set when the article publishes without a human, so no one could confirm an image's rights. */
  requireClearRights?: boolean
}

/** Falls back to English wording rather than dropping the disclosure when a key is missing. */
const captionLabels = async (language: Language): Promise<CaptionLabels> => {
  const t = await getServerTranslator(language)

  return {
    illustration: t('articles.image.illustration') || 'Illustrative image',
    ai: t('articles.image.ai') || 'Illustrative image (AI)',
    photoBy: t('articles.image.photoBy') || 'photo: {author}',
  }
}

export const finalizeArticle = async (
  object: ArticleObject,
  language: Language = 'en',
  callbacks: FinalizeCallbacks = {},
) => {
  const {
    onImage,
    onMedia,
    abortSignal,
    allowGeneratedImages = false,
    officialMediaPages = [],
    clientSiteId,
    requireClearRights = false,
    audit,
  } = callbacks
  const generateImageOptions = {
    clientSiteId,
    outputDir: 'article-images',
    filenamePrefix: 'article',
  }

  // A failed image must never cost the author the whole article, so every generation is
  // best-effort: report and carry on with one image fewer. Reported rather than logged because
  // swallowing it here is exactly what makes "the images did not appear" undiagnosable — nothing
  // downstream throws, so this is the only place the cause exists.
  const tryGenerateImage = async (prompt: string, opts?: { filenameSuffix?: string }) => {
    if (!allowGeneratedImages) return null
    try {
      const { url, width, height, storageKey, mimeType, sizeBytes, contentHash } = await auditArticleStep(
        audit,
        'image_generation',
        () => generateImage(prompt, { ...generateImageOptions, ...opts, abortSignal }),
        () => ({}),
        { slot: opts?.filenameSuffix ?? 'cover' },
      )
      return { url, width, height, storageKey, mimeType, sizeBytes, contentHash }
    } catch (error) {
      await reportCaughtError('Article image generation failed', error, { prompt })
      return null
    }
  }

  const acceptImage = createImageSelection()
  // Store media is uploaded by the publisher for promotion, whichever provider found it. Official pages are
  // re-hosted on our CDN, so the original address survives only as the credit's source.
  const fromStore = (image: Pick<ArticleImage, 'url' | 'credit'>) =>
    [image.url, image.credit?.sourceUrl].some((url) => !!url && !!storeMediaSource(url))
  const rightsClear = (asset: Partial<MediaAssetRecord>, url: string) =>
    !mediaRightsIssues({ key: url, placement: 'body', url }, asset as MediaAssetRecord).some(
      (issue) => issue.severity === 'warning',
    )
  const registerMedia = async (
    image: ArticleImage,
    searchHint?: string,
  ): Promise<ArticleImage & { mediaId?: string; rightsClear: boolean }> => {
    if (!clientSiteId) return { ...image, rightsClear: true }
    const asset = await registerMediaAsset({
      clientSiteId,
      url: image.url,
      deliveryUrl: image.url,
      storageKey: image.storageKey,
      name: searchHint,
      defaultAltText: image.alt,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      contentHash: image.contentHash,
      ...creditAsset(image.credit, image.kind !== 'ai' && fromStore(image)),
      ...(image.kind === 'ai' && { origin: 'TOPIQU_AI' as const }),
      width: image.width,
      height: image.height,
      metadataSignals: image.kind === 'ai' && searchHint ? { generationPrompt: searchHint } : undefined,
    })
    // The same rule the publish gate applies, on the asset as registered (a reused one may be confirmed).
    return { ...image, mediaId: asset.id, rightsClear: rightsClear(asset as MediaAssetRecord, image.url) }
  }
  const officialImages = [
    ...(await loadPressImages([...officialMediaPages])),
    ...(object.videos ?? []).flatMap((video) => {
      const thumbnail = youtubeThumbnailImage(video.url, video.caption)
      return thumbnail ? [thumbnail] : []
    }),
  ]
  const officialImageCache = new Map<string, Promise<StockImage | null>>()
  const storeSearches = [createSteamImageSearch(), createAppStoreImageSearch()]
  // Nobody confirms rights before an auto-publish, so a candidate that would need it is skipped
  // in favour of the next real one; AI stays the last resort.
  const clearCandidate = (image: StockImage) =>
    rightsClear({ ...creditAsset(image.credit, fromStore(image)), rightsConfirmedAt: null }, image.url)
  const findExistingImage = async (
    query: string,
    type: ArticleObject['images'][number]['type'],
    clearOnly = requireClearRights,
  ): Promise<{ image: StockImage; kind: ImageKind; source: ArticleMediaSource } | null> => {
    const clear = clearOnly ? clearCandidate : undefined
    // `acceptImage` records the pick, so it runs only once the candidate passed every other check.
    const pick = (image: StockImage) => (!clear || clear(image)) && acceptImage(image)
    // Official pages and store screenshots come from the subject's own publisher; library hits only
    // matched words in a description, so each one is looked at before it is taken.
    let checks = 0
    const shows = (subject: string, intent: typeof type) => async (image: StockImage) => {
      if ((clear && !clear(image)) || acceptImage.taken(image) || checks >= IMAGE_CHECKS) return false
      checks += 1
      const verdict = await auditArticleStep(
        audit,
        'image_check',
        () =>
          imageDepicts(
            image,
            {
              title: object.title,
              query: subject,
              type: intent,
              context: `${object.perex}\n${object.content.replace(/<[^>]+>/g, ' ').slice(0, 2600)}`,
            },
            abortSignal,
          ),
        (result) => ({ ...result }),
        { query: subject, sourceUrl: image.credit?.sourceUrl ?? image.url },
      )
      return verdict.depicts
    }
    const official = await findPressImage(officialImages, query, pick, officialImageCache)
    if (official) return { image: official, kind: 'illustration', source: 'official' }
    for (const search of storeSearches) {
      const screenshot = await search(query, pick)
      if (screenshot) return { image: screenshot, kind: 'illustration', source: 'screenshot' }
    }
    const hit = await findStockImage(type, query, undefined, shows(query, type))
    if (hit && acceptImage(hit.image)) return { ...hit, source: 'library' }
    // A named subject has real photos even when the scene the writer described does not; that beats
    // an AI illustration of any intent.
    const subject = photoSubjectQuery(query)
    if (subject) {
      const portrait = await findStockImage('photo', subject, undefined, shows(subject, 'photo'))
      if (portrait && acceptImage(portrait.image)) return { ...portrait, kind: 'illustration', source: 'library' }
    }
    return null
  }
  let articleImageUrl = ''
  let articleImageCredit: CoverCredit | null = null
  let articleCoverMediaId: string | null = null
  const mediaTotal = 1 + object.images.length
  let mediaCompleted = 0
  let mediaFound = 0
  let coverSource: ArticleMediaSource | null | undefined
  const slotSources: (ArticleMediaSource | null | undefined)[] = object.images.map(() => undefined)
  const reportMedia = (stage: ArticleMediaProgress['stage']) =>
    onMedia?.({
      stage,
      completed: mediaCompleted,
      total: mediaTotal,
      found: mediaFound,
      cover: coverSource,
      slots: [...slotSources],
    })
  reportMedia('cover')
  if (object.coverImage) {
    const { query, broaderQuery, type } = object.coverImage
    const broader = broaderQuery?.trim()
    const findCover = async (clearOnly: boolean) => {
      const exact = await findExistingImage(query, type, clearOnly)
      // A broader subject is a real photo of something else, so it is credited as illustrative.
      const related =
        exact || !broader || broader === query ? null : await findExistingImage(broader, 'photo', clearOnly)
      return exact ?? (related && { ...related, kind: 'illustration' as const })
    }
    let hit = await findCover(requireClearRights)
    // An article without a cover goes unread, so the cover alone falls back to a labelled AI
    // illustration even for a photo subject — one that shows no person, logo, text or real event.
    const generated = hit
      ? null
      : await tryGenerateImage(type === 'photo' ? coverIllustrationPrompt(broader || query) : query)
    // With no illustration either, a real cover that needs confirming still beats none; the article waits.
    if (!hit && !generated && requireClearRights) hit = await findCover(false)
    articleImageUrl = hit?.image.url ?? generated?.url ?? ''
    if (articleImageUrl) {
      articleImageCredit = hit ? { kind: hit.kind, credit: hit.image.credit } : { kind: 'ai' }
      const registered = await registerMedia(
        hit ? { ...hit.image, kind: hit.kind } : { ...generated!, kind: 'ai' as const },
        query,
      )
      articleCoverMediaId = registered.mediaId ?? null
      if (generated) acceptImage({ url: articleImageUrl })
    }
    coverSource = hit?.source ?? (generated ? 'ai' : null)
  } else coverSource = null
  mediaCompleted += 1
  if (articleImageUrl) mediaFound += 1
  reportMedia(object.images.length ? 'content' : 'complete')

  const labels = await captionLabels(language)

  /** Missing photos may fall back to labelled AI illustrations when enabled. */
  const resolveImage = async (
    instruction: ArticleObject['images'][number],
    idx: number,
  ): Promise<{ image: ArticleImage; source: ArticleMediaSource } | null> => {
    const hit = await findExistingImage(instruction.query, instruction.type)
    if (hit)
      return {
        source: hit.source,
        image: {
          url: hit.image.url,
          kind: hit.kind,
          width: hit.image.width,
          height: hit.image.height,
          alt: hit.image.alt,
          credit: hit.image.credit,
        },
      }

    const generated =
      instruction.type === 'photo'
        ? null
        : await tryGenerateImage(instruction.query, { filenameSuffix: idx.toString() })

    return generated && acceptImage(generated) ? { source: 'ai', image: { ...generated, kind: 'ai' } } : null
  }

  const settledImages = await Promise.all(
    object.images.map(async (img, idx) => {
      const resolved = await resolveImage(img, idx).finally(() => {
        mediaCompleted += 1
      })
      slotSources[idx] = resolved?.source ?? null
      if (!resolved) {
        reportMedia('content')
        return null
      }

      let registered = await registerMedia(resolved.image, img.query)
      // Inline images are optional: an auto-published article replaces or drops one it cannot clear.
      if (requireClearRights && !registered.rightsClear) {
        const generated =
          img.type === 'photo' ? null : await tryGenerateImage(img.query, { filenameSuffix: idx.toString() })
        if (!generated || !acceptImage(generated)) {
          slotSources[idx] = null
          reportMedia('content')
          return null
        }
        registered = await registerMedia({ ...generated, kind: 'ai' }, img.query)
        slotSources[idx] = 'ai'
      }
      const image = {
        slot: idx + 1,
        // A requested caption describes the desired asset, not the one a search retrieved, so it
        // would turn an image-search instruction into a hallucinated claim; provider metadata stays.
        // A generated picture was made from this instruction, so its caption is a faithful alt text.
        html: buildImageHtml(registered, registered.kind === 'ai' ? img.caption : '', labels),
        resolved: registered,
      }
      mediaFound += 1
      onImage?.(image)
      reportMedia('content')

      return image
    }),
  )

  const generatedImages = settledImages.filter((image) => image !== null).map(({ slot, html }) => ({ slot, html }))

  mediaCompleted = mediaTotal
  reportMedia('complete')

  object.content = dropBlankLines(dropAuthoredImages(stripUntrustedIframes(object.content)))
  object.content = applyContentSlots(object.content, 'IMAGE', generatedImages)

  const polls = (object.polls ?? []).map((poll, idx) => {
    const pollId = crypto.randomUUID()
    const optionObjects = poll.options.map((label: string) => ({ label }))
    const escapedOptions = JSON.stringify(optionObjects).replace(/"/g, '&quot;')
    return {
      slot: idx + 1,
      html: `<div data-type="poll" data-id="${pollId}" data-question="${poll.question}" data-options="${escapedOptions}"></div>`,
    }
  })
  object.content = applyContentSlots(object.content, 'POLL', polls)

  const videos = (object.videos ?? []).flatMap((video, idx) => {
    const src = youtubeEmbedUrl(video.url)
    if (!src) return []
    const caption = escapeHtml(video.caption)
    return [
      {
        slot: idx + 1,
        html: `<figure class="article-video"><div data-youtube-video><iframe class="youtube-video" src="${src}" title="${caption}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${caption}</figcaption></figure>`,
      },
    ]
  })
  object.content = applyContentSlots(object.content, 'VIDEO', videos)

  return { ...object, articleImageUrl, articleImageCredit, articleCoverMediaId }
}
