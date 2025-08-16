import crypto from 'crypto'

export async function logAction(params: {
  action: string
  userId: string
  clientSiteId?: string | null
  metadata?: Record<string, any>
  ip?: string
}) {
  const prev = await prisma.log.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })

  const previousHash = prev?.hash ?? null
  const raw = JSON.stringify({ ...params, previousHash, ts: Date.now() })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')

  return prisma.log.create({
    data: {
      action: params.action,
      userId: params.userId,
      clientSiteId: params.clientSiteId ?? null,
      metadata: params.metadata ?? {},
      ip: params.ip ?? null,
      previousHash,
      hash,
    },
  })
}
