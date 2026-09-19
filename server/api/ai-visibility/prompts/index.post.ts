import { z } from 'zod'
import { promptIntent } from '~~/shared/utils/aiVisibility'

const Body = z.object({
  text: z.string().trim().min(3).max(1000),
  language: z.enum(['cs', 'en']),
  country: z.string().trim().max(2).default(''),
})

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  const body = await readValidatedBody(event, Body.parse)

  try {
    const prompt = await db.aiVisibilityPrompt.create({
      data: {
        clientSiteId: user.clientSiteId!,
        text: body.text,
        language: body.language,
        country: body.country.toUpperCase(),
        intent: promptIntent(body.text),
      },
      select: { id: true, text: true, language: true, country: true, intent: true, source: true, active: true },
    })
    await logAction({
      action: 'AI_VISIBILITY_PROMPT_CREATED',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      metadata: { promptId: prompt.id, language: prompt.language, intent: prompt.intent },
    })
    return prompt
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, message: 'Prompt already exists' })
    throw error
  }
})
