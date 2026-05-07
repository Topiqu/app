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
  tx?: any
}) {
  const { tx, ...rest } = params
  const db = tx ?? prisma

  let userId = rest.userId
  if (!userId) {
    const systemUser = await db.user.findUnique({
      where: { id: SYSTEM_USER_ID },
      select: { id: true },
    })
    if (!systemUser) {
      await db.user.create({
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

  const prev = await db.log.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })

  const previousHash = prev?.hash ?? 'GENESIS'
  const payload = canonicalize({ ...rest, userId, previousHash, ts: Date.now() })
  const raw = JSON.stringify(payload)
  const hash = crypto.createHash('sha256').update(raw).digest('hex')

  return db.log.create({
    data: {
      action: rest.action,
      userId,
      clientSiteId: rest.clientSiteId ?? null,
      metadata: rest.metadata ?? {},
      ip: rest.ip ?? null,
      previousHash,
      hash,
    },
  })
}
