import type { RequestInternal } from 'next-auth'
import type { User } from '@zenstackhq/runtime/models'

import { UAParser } from 'ua-parser-js'

export const generateSessionToken = async (
  user: Pick<User, 'id' | 'clientSiteId'>,
  req: Pick<RequestInternal, 'body' | 'query' | 'headers' | 'method'>,
) => {
  const ipHeader = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? ''
  const ipAddress = ipHeader || null

  const userAgent = req.headers?.['user-agent'] ?? null
  const parser = new UAParser(userAgent)
  const { device, os, browser } = parser.getResult()

  const deviceName = device?.model ?? device?.vendor ?? device?.type ?? 'Desktop'
  const osName = os?.name ? `${os.name} ${os.version ?? ''}`.trim() : null
  const browserName = browser?.name ? `${browser.name} ${browser.version ?? ''}`.trim() : null

  const existingSession = await prisma.session.findFirst({
    where: {
      userId: user.id,
      revoked: false,
      deletedAt: null,
      device: deviceName,
      os: osName,
      browser: browserName,
    },
    select: { id: true, ip: true, clientSiteId: true },
  })

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.id, deletedAt: null, clientSite: { deletedAt: null } },
    select: { clientSiteId: true },
    orderBy: { createdAt: 'asc' },
  })
  const clientSiteId =
    memberships.find((membership) => membership.clientSiteId === existingSession?.clientSiteId)?.clientSiteId ??
    memberships.find((membership) => membership.clientSiteId === user.clientSiteId)?.clientSiteId ??
    memberships[0]?.clientSiteId ??
    null

  let sessionId: string

  if (existingSession) {
    sessionId = existingSession.id

    const dataToUpdate: any = { lastUsedAt: new Date(), clientSiteId }

    if (existingSession.ip !== ipAddress) {
      dataToUpdate.ip = ipAddress
      if (ipAddress) {
        const geo = await resolveGeo(ipAddress)
        dataToUpdate.city = geo.city
        dataToUpdate.region = geo.region
        dataToUpdate.country = geo.country
      } else {
        dataToUpdate.city = null
        dataToUpdate.region = null
        dataToUpdate.country = null
      }
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: dataToUpdate,
    })
  } else {
    let geo: any = { city: null, region: null, country: null }
    if (ipAddress) {
      geo = await resolveGeo(ipAddress)
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        ip: ipAddress,
        userAgent: userAgent || null,
        device: deviceName,
        os: osName,
        browser: browserName,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        lastUsedAt: new Date(),
        revoked: false,
        clientSiteId,
      },
    })

    sessionId = session.id

    try {
      await logAction({
        action: 'SESSION_CREATE',
        userId: user.id,
        ip: ipAddress ?? undefined,
        metadata: {
          sessionId,
          device: deviceName,
          os: osName ?? undefined,
          browser: browserName ?? undefined,
          city: geo.city ?? undefined,
          region: geo.region ?? undefined,
          country: geo.country ?? undefined,
        },
      })
    } catch (err) {
      await logger.error('audit:SESSION_CREATE failed', {
        source: 'audit',
        action: 'SESSION_CREATE',
        userId: user.id,
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return sessionId
}
