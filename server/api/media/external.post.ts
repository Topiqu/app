import { z } from 'zod'

const InputSchema = z.object({ url: z.string().url().max(2048) }).refine((body) => /^https:\/\//i.test(body.url))

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const { url } = await readValidatedBody(event, InputSchema.parse)
  const asset = await prisma.mediaAsset.create({
    data: { clientSiteId: user.clientSiteId!, createdById: user.id, url, sourceUrl: url, origin: 'UNKNOWN' },
  })
  return { asset }
})
