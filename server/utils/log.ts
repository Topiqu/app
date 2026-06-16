import crypto from 'crypto'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
const SYSTEM_USER_EMAIL = 'system@topiqu.com'
const SYSTEM_USER_NAME = 'TOPIQU'
const LOG_LOCK_KEY = 4815162342
const LOG_HMAC_SECRET = process.env.LOG_HMAC_SECRET || process.env.AUTH_SECRET || ''

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

  const write = async (db: any) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(${LOG_LOCK_KEY}::bigint)`

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

    const data = {
      action: rest.action,
      userId,
      clientSiteId: rest.clientSiteId ?? null,
      metadata: rest.metadata ?? {},
      ip: rest.ip ?? null,
      ts: new Date(),
      previousHash: prev?.hash ?? 'GENESIS',
    }

    const raw = JSON.stringify(canonicalize({ ...data, ts: data.ts.getTime() }))
    const hash = crypto.createHmac('sha256', LOG_HMAC_SECRET).update(raw).digest('hex')

    return db.log.create({ data: { ...data, hash } })
  }

  const entry = tx ? await write(tx) : await prisma.$transaction(write)

  await logger.info(`audit:${rest.action}`, {
    source: 'audit',
    action: rest.action,
    userId: entry.userId,
    clientSiteId: rest.clientSiteId ?? null,
    metadata: rest.metadata ?? {},
  })

  return entry
}
