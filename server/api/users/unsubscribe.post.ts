import { z } from 'zod'

const bodySchema = z.object({ u: z.string().min(1).max(64), t: z.string().min(1).max(64) })

// Authorized by the signed link alone, so it works signed out; the token only ever turns emails off.
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { u, t: token } = await readValidatedBody(event, bodySchema.parse)
  if (!isUnsubscribeToken(u, token)) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  await prisma.user.updateMany({ where: { id: u }, data: { allowEmail: false } })
  return { ok: true }
})
