import type { H3Event } from 'h3'

import { zxcvbn } from '@zxcvbn-ts/core'

export async function saveUserWithLogging(event: H3Event, data: any, isUpdate = false) {
  const ip = getIp(event)
  const strength = data.password ? zxcvbn(data.password).score : null
  const db = await getEnhancedPrisma((await getServerSession(event))?.user)
  const user = isUpdate
    ? await db.user.update({
        where: { id: data.id },
        data,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          clientSiteId: true,
          updatedAt: true,
        },
      })
    : await db.user.create({
        data,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          clientSiteId: true,
          createdAt: true,
        },
      })

  await logAction({
    action: isUpdate ? 'USER_UPDATE' : 'USER_CREATE',
    userId: user.id,
    clientSiteId: user.clientSiteId ?? null,
    ip,
    metadata: { username: user.username, email: user.email },
  })

  if (strength !== null) {
    await logAction({
      action: isUpdate ? 'PASSWORD_CHANGE' : 'PASSWORD_SET',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip,
      metadata: { passwordStrength: strength },
    })
  }

  return user
}
