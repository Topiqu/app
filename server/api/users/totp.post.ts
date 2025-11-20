import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email, password } = await readBody(event)
  if (!email || !password) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, totpSecret: true },
  })
  if (!user || !(await argon.verify(user.password!, password)))
    throw createError({ statusCode: 401, message: t('common.errors.invalidCredentials')! })

  return { id: user.id, totpSecret: user.totpSecret }
})
