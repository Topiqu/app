// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/images/publicFetch'), 'postPublicUrl', 'readLimitedBody')
  await stubNitroImports(import('../../server/utils/domains/probe'), 'probeDomainRouting')
  await stubNitroImports(
    import('../../server/utils/domains/providers'),
    'DomainProviderError',
    'cloudflareDomain',
    'checkCloudflareFallback',
    'cloudflareValidationRecords',
    'dokployDomainSchema',
    'dokployRequest',
    'domainProviderConfig',
    'findDokployDomain',
  )
  await stubNitroImports(
    import('../../server/utils/domains/certificates'),
    'decryptDomainCertificate',
    'verifyDomainCertificate',
  )
}

await stubImports()

const { createDatabaseClient } = await import('../../server/utils/database')
const { withDomainLease } = await import('../../server/utils/domains/connections')

const url = process.env.TEST_DATABASE_URL
const enabled = Boolean(url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL)
const db = enabled ? createDatabaseClient(url) : null
const siteIds: string[] = []
const userIds: string[] = []

describe.skipIf(!enabled)('PostgreSQL domain policies, claims and leases', () => {
  beforeAll(() => vi.stubGlobal('prisma', db))
  afterAll(async () => {
    if (db) {
      await db.domainConnection.deleteMany({ where: { clientSiteId: { in: siteIds } } })
      await db.user.deleteMany({ where: { id: { in: userIds } } })
      await db.clientSite.deleteMany({ where: { id: { in: siteIds } } })
      await db.$disconnect()
    }
    vi.unstubAllGlobals()
  })
  const fixture = async () => {
    const suffix = randomUUID()
    const site = await db!.clientSite.create({
      data: { name: `domain-fixture-${suffix}`, domain: `${suffix}.test`, plan: 'PRO' },
    })
    siteIds.push(site.id)
    const user = await db!.user.create({
      data: { username: suffix, email: `${suffix}@example.test`, role: 'admin', clientSiteId: site.id },
    })
    userIds.push(user.id)
    const connection = await db!.domainConnection.create({
      data: {
        host: `blog-${suffix}.test`,
        clientSiteId: site.id,
        challenge: 'fixture',
        probeSecret: 'probe-fixture',
        encryptedCertificate: 'cipher-fixture',
      },
    })
    return { site, user, connection }
  }

  it('blocks cross-tenant reads and all generic infrastructure writes', async () => {
    const a = await fixture()
    const b = await fixture()
    const scoped = db!.$use(new PolicyPlugin()).$setAuth({ id: a.user.id, role: 'admin', clientSiteId: a.site.id })
    expect(await scoped.domainConnection.findUnique({ where: { id: b.connection.id } })).toBeNull()
    await expect(
      scoped.domainConnection.update({ where: { id: a.connection.id }, data: { state: 'READY' } }),
    ).rejects.toThrow()
    await expect(
      scoped.domainConnection.create({
        data: { host: `${randomUUID()}.test`, clientSiteId: a.site.id, challenge: 'fake', probeSecret: 'fake' },
      }),
    ).rejects.toThrow()
  })
  it('does not expose probe or encrypted-key material even with explicit selects', async () => {
    const a = await fixture()
    const scoped = db!.$use(new PolicyPlugin()).$setAuth({ id: a.user.id, role: 'admin', clientSiteId: a.site.id })
    const result = await scoped.domainConnection
      .findUnique({
        where: { id: a.connection.id },
        select: { id: true, probeSecret: true, encryptedCertificate: true },
      })
      .catch(() => null)
    expect(result?.probeSecret).not.toBe('probe-fixture')
    expect(result?.encryptedCertificate).not.toBe('cipher-fixture')
    expect(
      await scoped.domainConnection.findUnique({ where: { id: a.connection.id }, select: { id: true, host: true } }),
    ).toMatchObject({ id: a.connection.id })
  })
  it('reserves a hostname globally across tenants', async () => {
    const a = await fixture()
    const b = await fixture()
    await expect(
      db!.domainConnection.create({
        data: { host: a.connection.host, clientSiteId: b.site.id, challenge: 'other', probeSecret: 'other' },
      }),
    ).rejects.toThrow()
  })
  it('serializes overlapping provider operations in the database', async () => {
    const a = await fixture()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const first = withDomainLease(a.connection.id, async () => {
      entered()
      await gate
    })
    await started
    try {
      await expect(withDomainLease(a.connection.id, async () => true)).rejects.toThrow('BUSY')
    } finally {
      release()
      await first
    }
    await expect(withDomainLease(a.connection.id, async () => 'released')).resolves.toBe('released')
  })
})

beforeEach(stubImports)
