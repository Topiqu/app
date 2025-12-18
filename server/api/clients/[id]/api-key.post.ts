import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const session = (await getServerSession(event))?.user
  const clientId = getRouterParam(event, 'id')

  if (!session) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  if (session.clientSiteId !== clientId && session.role !== 'superadmin') {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }

  const db = await getEnhancedPrisma(session)

  const existingClient = await db.clientSite.findUnique({
    where: { id: clientId },
  })

  if (!existingClient) {
    throw createError({ statusCode: 404, message: t('common.errors.notFound')! })
  }

  const newApiKey = `sk_${randomBytes(32).toString('hex')}`

  const updatedClient = await db.clientSite.update({
    where: { id: clientId },
    data: {
      apiKey: newApiKey,
    },
    select: {
      apiKey: true,
    },
  })

  return {
    apiKey: updatedClient.apiKey,
  }
})
