import { z } from 'zod'
import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { KNOWLEDGE_CONSENT_VERSION, KNOWLEDGE_CURRENCIES, KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'
import {
  extractKnowledgeFile,
  extractKnowledgeUrl,
  normalizeKnowledgeText,
  type ExtractedKnowledge,
} from '~~/server/utils/knowledge/extract'
import {
  assertCitableUrl,
  hashKnowledge,
  kickKnowledgeIndex,
  knowledgeExtractFailure,
  knowledgeLimits,
  KNOWLEDGE_SOURCE_VIEW,
  limitKnowledgeRequests,
  requireKnowledgeAccess,
} from '~~/server/utils/knowledge/sources'

const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

const FieldsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NOTE'), title: z.string().trim().min(1).max(200), text: z.string().trim().min(1) }),
  z.object({ kind: z.literal('FILE'), title: z.string().trim().max(200).optional() }),
  z.object({
    kind: z.literal('URL'),
    title: z.string().trim().max(200).optional(),
    url: z.string().trim().url().max(2048),
  }),
  z.object({
    kind: z.literal('FEED'),
    title: z.string().trim().max(200).optional(),
    url: z.string().trim().url().max(2048),
    language: z.enum(LANGUAGE_OPTIONS),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((code) => KNOWLEDGE_CURRENCIES.includes(code)),
  }),
])

const OptionsSchema = z.object({
  useInArticles: flag.default(true),
  isPublic: flag.default(false),
  publicUrl: z.string().trim().url().max(2048).optional(),
  validAsOf: z.iso.date().optional(),
})

export default defineEventHandler(async (event) => {
  const { user, clientSiteId, db } = await requireKnowledgeAccess(event)
  await requireAiPlan(clientSiteId, 'Knowledge requires an AI plan')
  await limitKnowledgeRequests(event, clientSiteId, 'create', 60)
  const limits = await knowledgeLimits(clientSiteId)
  if (limits.usage.sources >= limits.maxSources)
    throw createError({ statusCode: 409, statusMessage: 'Knowledge quota reached', data: { code: 'KNOWLEDGE_QUOTA' } })

  if (Number(getRequestHeader(event, 'content-length') ?? 0) > KNOWLEDGE_LIMITS.maxFileBytes + 64 * 1024)
    throw createError({ statusCode: 413, statusMessage: 'Knowledge upload is too large' })
  const parts = (await readMultipartFormData(event)) ?? []
  const text = (name: string) => {
    const part = parts.find((entry) => entry.name === name && !entry.filename)
    return part ? part.data.toString('utf8') : undefined
  }
  // Checked before any fetch or parse: the user confirms that everything added may reach a published
  // article and is processed by the AI provider. The audit row below is the record of it.
  if (text('confirmed') !== 'true')
    throw createError({ statusCode: 400, statusMessage: 'Confirmation required', data: { code: 'KNOWLEDGE_CONSENT' } })
  const fieldNames = [
    'kind',
    'title',
    'text',
    'url',
    'language',
    'currency',
    'useInArticles',
    'isPublic',
    'publicUrl',
    'validAsOf',
  ]
  const raw = Object.fromEntries(fieldNames.map((name) => [name, text(name) || undefined]))
  const fields = FieldsSchema.safeParse(raw)
  const options = OptionsSchema.safeParse(raw)
  if (!fields.success || !options.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid knowledge source' })
  const input = fields.data

  let extracted: ExtractedKnowledge
  let originalFilename: string | null = null
  let sizeBytes: number | null = null
  let sourceUrl: string | null = null
  try {
    if (input.kind === 'NOTE') {
      if (input.text.length > KNOWLEDGE_LIMITS.maxNoteCharacters)
        throw createError({ statusCode: 413, statusMessage: 'Note is too long' })
      extracted = { title: input.title, content: normalizeKnowledgeText(input.text), mimeType: 'text/markdown' }
    } else if (input.kind === 'FILE') {
      const file = parts.find((entry) => entry.name === 'file' && entry.filename)
      if (!file) throw createError({ statusCode: 400, statusMessage: 'Missing file' })
      originalFilename = file.filename!.split(/[/\\]/).pop()!.slice(0, 255)
      sizeBytes = file.data.byteLength
      extracted = await extractKnowledgeFile(new Uint8Array(file.data), originalFilename)
    } else if (input.kind === 'URL') {
      sourceUrl = await assertCitableUrl(input.url)
      extracted = await extractKnowledgeUrl(sourceUrl)
    } else {
      if (limits.usage.products >= limits.maxProducts)
        throw createError({
          statusCode: 409,
          statusMessage: 'Knowledge quota reached',
          data: { code: 'KNOWLEDGE_QUOTA' },
        })
      // The background sync fetches the feed: it can be tens of megabytes. The host, not the URL,
      // titles it, because feed URLs often carry an access token.
      sourceUrl = await assertCitableUrl(input.url)
      extracted = { title: new URL(sourceUrl).hostname, content: '', mimeType: 'application/xml' }
    }
  } catch (error) {
    throw await knowledgeExtractFailure(event, error)
  }

  const { useInArticles } = options.data
  // Feed products are citable through their own page URLs; the feed itself never is.
  const isPublic = options.data.isPublic && input.kind !== 'FEED'
  const publicUrl = !isPublic
    ? null
    : input.kind === 'URL'
      ? sourceUrl
      : options.data.publicUrl
        ? await assertCitableUrl(options.data.publicUrl)
        : null
  if (isPublic && !publicUrl)
    throw createError({ statusCode: 422, statusMessage: 'A public source needs its canonical URL' })

  if (limits.usage.characters + extracted.content.length > limits.maxCharacters)
    throw createError({ statusCode: 409, statusMessage: 'Knowledge quota reached', data: { code: 'KNOWLEDGE_QUOTA' } })

  // Every feed starts empty, so a feed is a duplicate by its address; the sync replaces this hash.
  const contentHash = hashKnowledge(input.kind === 'FEED' ? sourceUrl! : extracted.content)
  const duplicate = await db.knowledgeSource.findFirst({
    where:
      input.kind === 'FEED'
        ? { clientSiteId, kind: 'FEED', sourceUrl, deletedAt: null }
        : { clientSiteId, contentHash, deletedAt: null },
    select: { id: true },
  })
  if (duplicate)
    throw createError({
      statusCode: 409,
      statusMessage: 'This content is already in knowledge',
      data: { code: 'KNOWLEDGE_DUPLICATE', id: duplicate.id },
    })

  const source = await db.knowledgeSource.create({
    data: {
      clientSiteId,
      createdById: user.id,
      kind: input.kind,
      title: input.title || extracted.title || originalFilename || sourceUrl || 'Untitled',
      useInArticles,
      publicUrl,
      sourceUrl,
      originalFilename,
      mimeType: extracted.mimeType,
      sizeBytes,
      content: extracted.content,
      contentHash,
      ...(input.kind === 'FEED'
        ? { language: input.language, currency: input.currency }
        : {
            validAsOf: options.data.validAsOf ? new Date(options.data.validAsOf) : (extracted.validAsOf ?? null),
            fetchedAt: sourceUrl ? new Date() : null,
          }),
    },
    select: KNOWLEDGE_SOURCE_VIEW,
  })
  await logAction({
    action: 'KNOWLEDGE_SOURCE_CREATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: {
      sourceId: source.id,
      kind: source.kind,
      useInArticles,
      public: Boolean(publicUrl),
      characters: extracted.content.length,
      consent: { version: KNOWLEDGE_CONSENT_VERSION, confirmedAt: new Date().toISOString() },
    },
  })
  kickKnowledgeIndex(source.id)
  setResponseStatus(event, 201)
  return { source }
})
