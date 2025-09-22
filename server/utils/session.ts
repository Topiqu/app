import type { RequestInternal } from 'next-auth'
import type { User } from '@zenstackhq/runtime/models'

import { UAParser } from 'ua-parser-js'

export const generateSessionToken = async (
  user: Pick<User, 'id'>,
  req: Pick<RequestInternal, 'body' | 'query' | 'headers' | 'method'>,
) => {
  const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? ''
  const userAgent = req.headers?.['user-agent'] ?? null
  const parser = new UAParser(userAgent)
  const { device, os, browser } = parser.getResult()
  const geo = await resolveGeo(ip)
  const existingSession = await prisma.session.findFirst({
    where: {
      userId: user.id,
      ip,
      revoked: false,
      device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
      os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : null,
      browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null,
    },
    select: { id: true },
  })

  let sessionId: string
  if (existingSession) {
    sessionId = existingSession.id

    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    })
  } else {
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
        os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : null,
        browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        lastUsedAt: new Date(),
        revoked: false,
      },
    })

    sessionId = session.id

    await logAction({
      action: 'SESSION_CREATE',
      userId: user.id,
      ip: ip ?? undefined,
      metadata: {
        sessionId,
        device: device?.model ?? device?.vendor ?? device?.type ?? 'Desktop',
        os: os?.name ? `${os.name} ${os.version ?? ''}`.trim() : undefined,
        browser: browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : undefined,
        city: geo.city,
        region: geo.region,
        country: geo.country,
      },
    })
  }

  return sessionId
}
