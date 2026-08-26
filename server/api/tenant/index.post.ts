import { randomBytes } from 'node:crypto'
import { z } from 'zod'

import { ThemeSchema } from '~~/shared/zod/enums/Theme.schema'
import { domainVerificationDefaults, normalizeDomain, validateSubdomain } from '~~/shared/utils/domain'

const MAX_OWNED_BASIC_TENANTS = 3

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  subdomain: z.string().trim().toLowerCase(),
  language: z.enum(['cs', 'en']),
  theme: ThemeSchema.default('indigo'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'ai') throw createError({ statusCode: 403, message: 'AI users cannot create blogs' })
  if (!user.sessionId) throw createError({ statusCode: 401, message: 'Active session required' })

  const allowed = await consumeRateLimit(`tenant-create:${user.id}`, 5, 60 * 60)
  if (!allowed)
    throw createError({ statusCode: 429, message: 'Too many blog creation attempts', data: { code: 'RATE_LIMITED' } })

  const body = await readValidatedBody(event, schema.parse)
  const subdomainReason = validateSubdomain(body.subdomain)
  if (subdomainReason)
    throw createError({
      statusCode: 400,
      message: 'Invalid or reserved subdomain',
      data: { code: 'INVALID_SUBDOMAIN', reason: subdomainReason },
    })

  const baseDomain = normalizeDomain(useRuntimeConfig(event).public.baseDomain || 'topiqu.com')
  const domain = `${body.subdomain}.${baseDomain}`

  const session = await prisma.session.findFirst({
    where: { id: user.sessionId, userId: user.id, revoked: false, deletedAt: null },
    select: { id: true },
  })
  if (!session) throw createError({ statusCode: 401, message: 'Active session required' })

  const ownedBasicCount = await prisma.tenantMembership.count({
    where: {
      userId: user.id,
      role: 'OWNER',
      deletedAt: null,
      clientSite: { plan: 'BASIC', deletedAt: null },
    },
  })
  if (ownedBasicCount >= MAX_OWNED_BASIC_TENANTS)
    throw createError({
      statusCode: 403,
      message: 'Basic blog limit reached',
      data: { code: 'TENANT_LIMIT_REACHED', limit: MAX_OWNED_BASIC_TENANTS },
    })

  const [domainConflict, nameConflict] = await Promise.all([
    prisma.clientSite.findUnique({ where: { domain }, select: { id: true } }),
    prisma.clientSite.findUnique({ where: { name: body.name }, select: { id: true } }),
  ])
  if (domainConflict)
    throw createError({ statusCode: 409, message: 'Subdomain already exists', data: { code: 'SUBDOMAIN_TAKEN' } })
  if (nameConflict)
    throw createError({ statusCode: 409, message: 'Blog name already exists', data: { code: 'NAME_TAKEN' } })

  let site: { id: string; name: string; domain: string; language: 'cs' | 'en' }
  try {
    site = await prisma.$transaction(async (tx) => {
      const created = await tx.clientSite.create({
        data: {
          name: body.name,
          domain,
          language: body.language,
          theme: body.theme,
          plan: 'BASIC',
          tokenLimit: 0,
          tokenRemaining: 0,
          ...domainVerificationDefaults(domain, randomBytes(24).toString('base64url'), baseDomain),
        },
        select: { id: true, name: true, domain: true, language: true },
      })

      await tx.tenantMembership.create({
        data: { clientSiteId: created.id, userId: user.id, role: 'OWNER', scopes: [...TENANT_SCOPES] },
      })
      await tx.session.update({ where: { id: session.id }, data: { clientSiteId: created.id } })
      if (user.role === 'reader' || !user.clientSiteId) {
        await tx.user.update({
          where: { id: user.id },
          data: { role: user.role === 'reader' ? 'admin' : user.role, clientSiteId: user.clientSiteId || created.id },
        })
      }

      await logAction({
        action: 'TENANT_CREATED',
        userId: user.id,
        clientSiteId: created.id,
        ip: getIp(event),
        metadata: { source: 'self_service', domain: created.domain, plan: 'BASIC' },
        tx,
      })

      return created
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = String(error?.meta?.target ?? '')
      const code = target.includes('name') ? 'NAME_TAKEN' : 'SUBDOMAIN_TAKEN'
      throw createError({ statusCode: 409, message: 'Blog already exists', data: { code } })
    }
    throw error
  }

  return site
})
