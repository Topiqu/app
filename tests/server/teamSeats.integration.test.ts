// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../server/utils/database'
import { activeTeamSeatIds, requireTeamSeatCapacity } from '../../server/utils/teamSeats'

const url = process.env.TEST_DATABASE_URL
const enabled = Boolean(url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL)
const db = enabled ? createDatabaseClient(url) : null
const siteIds: string[] = []
const userIds: string[] = []

describe.skipIf(!enabled)('PostgreSQL team seat reservations', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  afterAll(async () => {
    if (db) {
      await db.tenantInvitation.deleteMany({ where: { clientSiteId: { in: siteIds } } })
      await db.tenantMembership.deleteMany({ where: { clientSiteId: { in: siteIds } } })
      await db.user.deleteMany({ where: { id: { in: userIds } } })
      await db.clientSite.deleteMany({ where: { id: { in: siteIds } } })
      await db.$disconnect()
    }
    vi.unstubAllGlobals()
  })
  const fixture = async () => {
    const suffix = randomUUID()
    const site = await db!.clientSite.create({
      data: { name: `seats-${suffix}`, domain: `${suffix}.test`, plan: 'PRO' },
    })
    siteIds.push(site.id)
    const user = await db!.user.create({
      data: { username: suffix, email: `${suffix}@example.test`, clientSiteId: site.id },
    })
    userIds.push(user.id)
    const owner = await db!.tenantMembership.create({
      data: { clientSiteId: site.id, userId: user.id, role: 'OWNER', scopes: [] },
    })
    return { site, user, owner }
  }

  it('allows only one simultaneous reservation beside the Pro owner', async () => {
    const { site, user } = await fixture()
    const reserve = (index: number) =>
      db!.$transaction(async (tx) => {
        await requireTeamSeatCapacity(tx, site.id)
        await tx.tenantInvitation.create({
          data: {
            clientSiteId: site.id,
            invitedById: user.id,
            email: `seat-${index}@example.test`,
            tokenHash: randomUUID(),
            scopes: [],
            expiresAt: new Date(Date.now() + 60000),
          },
        })
      })
    const results = await Promise.allSettled([reserve(1), reserve(2), reserve(3), reserve(4)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of results)
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ statusCode: 403, data: { code: 'TEAM_SEAT_LIMIT' } })
    expect(await db!.tenantInvitation.count({ where: { clientSiteId: site.id } })).toBe(1)
  })

  it('retains the owner on Basic and restores older members after upgrading', async () => {
    const { site, owner } = await fixture()
    const suffix = randomUUID()
    const member = await db!.user.create({
      data: { username: suffix, email: `${suffix}@example.test`, clientSiteId: site.id },
    })
    userIds.push(member.id)
    const membership = await db!.tenantMembership.create({
      data: {
        clientSiteId: site.id,
        userId: member.id,
        role: 'MEMBER',
        scopes: ['ARTICLE_WRITE'],
        createdAt: new Date('2020-01-01'),
      },
    })
    expect(await activeTeamSeatIds(db!, site.id, 'BASIC')).toEqual(new Set([owner.id]))
    expect(await activeTeamSeatIds(db!, site.id, 'PRO')).toEqual(new Set([owner.id, membership.id]))
    expect(await db!.tenantMembership.count({ where: { clientSiteId: site.id } })).toBe(2)
  })
})
