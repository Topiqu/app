import argon from 'argon2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_PASSWORD = 'test1234'

async function main() {
  const passwordHash = await argon.hash(TEST_PASSWORD)

  const site = await prisma.clientSite.upsert({
    where: { name: 'topiqu-dev' },
    update: {},
    create: {
      name: 'topiqu-dev',
      domain: 'localhost',
      domainVerified: true,
      plan: 'BASIC',
      language: 'cs',
      tokenLimit: 20000,
      tokenRemaining: 20000,
    },
  })

  const users = [
    { username: 'reader', email: 'reader@test.local', role: 'reader' as const },
    { username: 'admin', email: 'admin@test.local', role: 'admin' as const, clientSiteId: site.id },
    { username: 'superadmin', email: 'super@test.local', role: 'superadmin' as const },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        password: passwordHash,
        role: u.role,
        emailVerified: true,
        language: 'cs',
        clientSiteId: 'clientSiteId' in u ? u.clientSiteId : null,
      },
    })
  }

  console.log('✅ Seed done')
  console.log('   ClientSite:', site.name, '(plan:', site.plan + ')')
  console.log('   Users (password = "' + TEST_PASSWORD + '"):')
  for (const u of users) console.log('   -', u.email, '→', u.role)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
