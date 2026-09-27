import { z } from 'zod'
import { toHostname } from '~~/shared/utils/domain'

const Body = z.object({
  domain: z
    .string()
    .max(253)
    .transform(toHostname)
    .pipe(z.string().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)),
  mark: z.enum(['COMPETITOR', 'HIDDEN']).nullable(),
})

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const clientSiteId = user.clientSiteId!
  const { domain, mark } = await readValidatedBody(event, Body.parse)

  const where = { clientSiteId_domain: { clientSiteId, domain } }
  if (mark) await db.aiVisibilityDomain.upsert({ where, create: { clientSiteId, domain, mark }, update: { mark } })
  else await db.aiVisibilityDomain.deleteMany({ where: { clientSiteId, domain } })

  await logAction({
    action: 'AI_VISIBILITY_DOMAIN_MARKED',
    userId: user.id,
    clientSiteId,
    metadata: { domain, mark },
  })
  return { domain, mark }
})
