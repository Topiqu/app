import type { Language } from '~~/generated/zenstack/models'
import type { CoverCredit, ImageKind } from '~~/shared/utils/imageCredit'
import type { ArticleMediaProgress, ArticleMediaSource } from '~~/shared/utils/articleGeneration'

import { stripUntrustedIframes, youtubeEmbedUrl } from '~~/shared/utils/youtube'

import type { ArticleObject } from './articleConfig'
import type { ArticleImage, StockImage } from '../images/types'

import { escapeHtml } from '../sanitize'
import { findStockImage } from '../images/chain'
import { createSteamImageSearch } from '../images/steam'
import { buildImageHtml, type CaptionLabels } from '../images/caption'
import { createImageSelection, photoSubjectQuery } from '../images/selection'
import { findPressImage, loadPressImages, youtubeThumbnailImage } from '../images/press'

type FinalizeImage = { slot: number; html: string }

const coverIllustrationPrompt = (subject: string) =>
  `Atmospheric editorial illustration evoking ${subject}. No people, faces, logos, text or depiction of a specific real event.`
export type FinalizeCallbacks = {
  onImage?: (image: FinalizeImage) => void
  onMedia?: (progress: ArticleMediaProgress) => void
  abortSignal?: AbortSignal
  allowGeneratedImages?: boolean
  officialMediaPages?: readonly string[]
  clientSiteId?: string
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
  } = callbacks
  const generateImageOptions = {
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
      const { url, width, height } = await generateImage(prompt, { ...generateImageOptions, ...opts, abortSignal })
      return { url, width, height }
    } catch (error) {
      await reportCaughtError('Article image generation failed', error, { prompt })
      return null
    }
  }

  const acceptImage = createImageSelection()
  const registerMedia = async (image: ArticleImage, searchHint?: string) => {
    if (!clientSiteId) return image
    const credit = image.credit
    const creativeCommons = Boolean(credit?.license?.toUpperCase().startsWith('CC'))
    const origin = image.kind === 'ai' ? 'TOPIQU_AI' : creativeCommons ? 'CREATIVE_COMMONS' : 'EXTERNAL'
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
      origin,
      sourceUrl: credit?.sourceUrl,
      author: credit?.author,
      license: credit?.license,
      licenseUrl: credit?.licenseUrl,
      attribution: credit ? [credit.author, credit.license, credit.source].filter(Boolean).join(' · ') : null,
      attributionRequired: creativeCommons,
      width: image.width,
      height: image.height,
      metadataSignals: image.kind === 'ai' && searchHint ? { generationPrompt: searchHint } : undefined,
    })
    return { ...image, mediaId: asset.id }
  }
  const officialImages = [
    ...(await loadPressImages([...officialMediaPages])),
    ...(object.videos ?? []).flatMap((video) => {
      const thumbnail = youtubeThumbnailImage(video.url, video.caption)
      return thumbnail ? [thumbnail] : []
    }),
  ]
  const officialImageCache = new Map<string, Promise<StockImage | null>>()
  const findSteamImage = createSteamImageSearch()
  const findExistingImage = async (
    query: string,
    type: ArticleObject['images'][number]['type'],
  ): Promise<{ image: StockImage; kind: ImageKind; source: ArticleMediaSource } | null> => {
    const official = await findPressImage(officialImages, query, acceptImage, officialImageCache)
    if (official) return { image: official, kind: 'illustration', source: 'official' }
    const screenshot = await findSteamImage(query, acceptImage)
    if (screenshot) return { image: screenshot, kind: 'illustration', source: 'screenshot' }
    const hit = await findStockImage(type, query)
    if (hit && acceptImage(hit.image)) return { ...hit, source: 'library' }
    // A named subject has real photos even when the scene the writer described does not; that beats
    // an AI illustration of any intent.
    const subject = photoSubjectQuery(query)
    if (subject) {
      const portrait = await findStockImage('photo', subject)
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
    const exact = await findExistingImage(query, type)
    // A broader subject is a real photo of something else, so it is credited as illustrative.
    const related = exact || !broader || broader === query ? null : await findExistingImage(broader, 'photo')
    const hit = exact ?? (related && { ...related, kind: 'illustration' as const })
    // An article without a cover goes unread, so the cover alone falls back to a labelled AI
    // illustration even for a photo subject — one that shows no person, logo, text or real event.
    const generated = hit
      ? null
      : await tryGenerateImage(type === 'photo' ? coverIllustrationPrompt(broader || query) : query)
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

      const registered = await registerMedia(resolved.image, img.query)
      const image = {
        slot: idx + 1,
        // A requested caption describes the desired asset, not the asset that was actually
        // retrieved or generated. Publishing it as observed fact (or alt text) would turn an
        // image-search instruction into a hallucinated claim. Provider metadata remains safe.
        html: buildImageHtml(registered, '', labels),
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
