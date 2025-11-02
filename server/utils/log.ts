import crypto from 'crypto'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
const SYSTEM_USER_EMAIL = 'system@topiqu.com'
const SYSTEM_USER_NAME = 'TOPIQU'

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
  userId?: string
  clientSiteId?: string | null
  metadata?: Record<string, any>
  ip?: string
}) {
  let userId = params.userId
  if (!userId) {
    const systemUser = await prisma.user.findUnique({
      where: { id: SYSTEM_USER_ID },
      select: { id: true },
    })
    if (!systemUser) {
      await prisma.user.create({
        data: {
          id: SYSTEM_USER_ID,
          username: SYSTEM_USER_NAME,
          email: SYSTEM_USER_EMAIL,
          role: 'superadmin',
          emailVerified: true,
        },
      })
    }
    userId = SYSTEM_USER_ID
  }

  const prev = await prisma.log.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })

  const previousHash = prev?.hash ?? 'GENESIS'
  const payload = canonicalize({ ...params, userId, previousHash, ts: Date.now() })
  const raw = JSON.stringify(payload)
  const hash = crypto.createHash('sha256').update(raw).digest('hex')

  return prisma.log.create({
    data: {
      action: params.action,
      userId,
      clientSiteId: params.clientSiteId ?? null,
      metadata: params.metadata ?? {},
      ip: params.ip ?? null,
      previousHash,
      hash,
    },
  })
}
