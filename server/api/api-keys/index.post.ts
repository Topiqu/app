import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'API_KEY_CONTROL')
  const clientSiteId = user.clientSiteId
  const body = await readValidatedBody(
    event,
    z.object({
      name: z.string().trim().min(1).max(API_KEY_NAME_MAX),
      scopes: z.array(z.enum(API_KEY_SCOPES)).max(API_KEY_SCOPES.length),
    }).parse,
  )
  // Every key reads; the rest is opt-in.
  const scopes = [...new Set(['READ' as const, ...body.scopes])]

  const writes = scopes.some((scope) => (API_WRITE_SCOPES as readonly string[]).includes(scope))
  if (writes) {
    const site = await prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } })
    if (!site || site.plan === 'BASIC')
      throw createError({ statusCode: 403, message: 'Writing through the API requires the Pro plan' })
  }
  // A key acts for its creator, so nobody can mint one that does more than they may.
  const missing = requiredTenantScopes(scopes).filter((scope) => !hasTenantScope(membership, scope))
  if (missing.length) throw createError({ statusCode: 403, message: `Missing tenant scope: ${missing.join(', ')}` })

  const db = await getEnhancedPrisma(user)
  if ((await db.apiKey.count({ where: { clientSiteId, revokedAt: null, deletedAt: null } })) >= MAX_API_KEYS)
    throw createError({ statusCode: 409, message: `At most ${MAX_API_KEYS} API keys per site` })

  const secret = createApiKeySecret()
  const apiKey = await db.apiKey.create({
    data: { clientSiteId, name: body.name, prefix: secret.prefix, hash: secret.hash, scopes, createdById: user.id },
    select: API_KEY_VIEW,
  })
  await logAction({
    action: 'API_KEY_CREATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { apiKeyId: apiKey.id, name: apiKey.name, scopes },
  })
  // The only time the key leaves the server; only its hash is stored.
  return { apiKey, key: secret.key }
})
