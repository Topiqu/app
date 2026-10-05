// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

import { inboxOwnsSite } from '../../server/utils/trialInbox'
import { createDatabaseClient } from '../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('inboxOwnsSite on PostgreSQL', () => {
  afterAll(async () => {
    await db?.$disconnect()
  })

  const owner = async (email: string, role: 'OWNER' | 'MEMBER' = 'OWNER') => {
    const id = randomUUID()
    await db!.clientSite.create({ data: { id, name: `trial-inbox-${id}`, domain: `${id}.test` } })
    const user = await db!.user.create({
      data: { username: `u-${id}`, email, password: 'not-a-real-hash', clientSiteId: id, role: 'admin' },
    })
    await db!.tenantMembership.create({ data: { clientSiteId: id, userId: user.id, role } })
  }
  const owns = (email: string) => db!.$transaction((tx) => inboxOwnsSite(tx, email))

  it('matches the SQL spelling to canonicalEmail', async () => {
    const tag = randomUUID().slice(0, 8)
    await owner(`Jan.Novak${tag}@gmail.com`)
    await owner(`eva${tag}+shop@Firma.cz`)

    expect(await owns(`jannovak${tag}+second@googlemail.com`)).toBe(true)
    expect(await owns(`EVA${tag}@firma.cz`)).toBe(true)
    expect(await owns(`e.va${tag}@firma.cz`)).toBe(false)
  })

  it('ignores inboxes that are only members', async () => {
    const email = `member-${randomUUID()}@firma.cz`
    await owner(email, 'MEMBER')
    expect(await owns(email)).toBe(false)
  })
})
