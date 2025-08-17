import crypto from 'crypto'

const canonicalize = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(canonicalize)
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalize(obj[key])
      return acc
    }, {} as any)
}

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

  const previousHash = prev?.hash ?? 'GENESIS'
  const payload = canonicalize({ ...params, previousHash, ts: Date.now() })
  const raw = JSON.stringify(payload)
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
