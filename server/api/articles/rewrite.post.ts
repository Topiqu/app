import { z } from 'zod'
import {
  DOCUMENT_EDIT_MAX_BLOCKS,
  DOCUMENT_EDIT_MAX_LENGTH,
  TEXT_EDIT_ACTIONS,
  TEXT_EDIT_INSTRUCTION_MAX_LENGTH,
  TEXT_EDIT_MAX_LENGTH,
} from '~~/shared/utils/aiEdit'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireTenantScope(event, 'ARTICLE_WRITE', user.clientSiteId)

  await ensureMinAccountAge(event, user.id)
  await requireAiPlan(user.clientSiteId, t('common.errors.featureNotInPlan')!)

  const input = await readValidatedBody(
    event,
    z.union([
      z
        .object({
          html: z.string().trim().nonempty(t('common.errors.missing')!).max(TEXT_EDIT_MAX_LENGTH),
          action: z.enum(TEXT_EDIT_ACTIONS),
          instruction: z.string().trim().min(1).max(TEXT_EDIT_INSTRUCTION_MAX_LENGTH).optional(),
        })
        .refine((value) => value.action !== 'improve' || Boolean(value.instruction), { path: ['instruction'] }),
      z.object({
        blocks: z
          .array(z.string().trim().min(1).max(TEXT_EDIT_MAX_LENGTH))
          .min(1)
          .max(DOCUMENT_EDIT_MAX_BLOCKS)
          .refine((blocks) => blocks.reduce((total, block) => total + block.length, 0) <= DOCUMENT_EDIT_MAX_LENGTH),
        action: z.literal('improve'),
        instruction: z.string().trim().min(1).max(TEXT_EDIT_INSTRUCTION_MAX_LENGTH),
      }),
    ]).parse,
  )
  if (!(await consumeRateLimit(`rewrite-text:${user.clientSiteId}:${user.id}`, 40, 10 * 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  if ('blocks' in input) {
    const blocks = input.blocks.map(sanitizeInlineText)
    if (blocks.some((html) => !html.replace(/<[^>]*>/g, '').trim()))
      throw createError({ statusCode: 400, message: t('articles.editor.aiEdit.unsupported')! })
    const result = await rewriteDocumentBlocks(blocks, input.instruction)
    await recordAiUsage(
      user.clientSiteId,
      result.usage.totalTokens ?? 0,
      'REWRITE_TEXT',
      { usage: result.usage, action: input.action, scope: 'document' },
      event,
    )
    return { blocks: result.blocks }
  }

  const result = await rewritePassage(sanitizePassage(input.html), input.action, input.instruction)
  await recordAiUsage(
    user.clientSiteId,
    result.usage.totalTokens ?? 0,
    'REWRITE_TEXT',
    { usage: result.usage, action: input.action, scope: 'selection' },
    event,
  )
  if (!result.html.trim()) throw createError({ statusCode: 502, message: t('articles.editor.aiEdit.failed')! })
  return { html: result.html }
})
