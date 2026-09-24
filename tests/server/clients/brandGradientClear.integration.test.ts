// @vitest-environment node
import { DbNull } from '@zenstackhq/orm'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

// Turning the gradient switch off PATCHes `brandGradient: null`; the handler must map it to DbNull.
describe.skipIf(!enabled)('clearing ClientSite.brandGradient', () => {
  afterAll(async () => {
    await db?.$disconnect()
  })

  it('rejects a bare null and clears the column with DbNull', async () => {
    const id = randomUUID()
    await db!.clientSite.create({
      data: {
        id,
        name: `gradient-test-${id}`,
        domain: `${id}.test`,
        brandGradient: { colors: ['#2563EB', '#0F172A'], angle: 135 },
      },
    })

    await expect(
      db!.clientSite.update({ where: { id }, data: { brandGradient: null as never } }),
    ).rejects.toThrow(/brandGradient/)
    await db!.clientSite.update({ where: { id }, data: { brandGradient: DbNull } })

    const row = await db!.clientSite.findUnique({ where: { id }, select: { brandGradient: true } })
    expect(row?.brandGradient).toBeNull()
  })
})
