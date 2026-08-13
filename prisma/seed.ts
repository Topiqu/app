import argon from 'argon2'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_PASSWORD = 'test1234'

const FEATURE_CATALOG = [
  { code: 'AI' as const, name: 'AI Generation', priceMonthly: 29 },
  { code: 'SENTIMENT' as const, name: 'Sentiment Analysis', priceMonthly: 19 },
  { code: 'ARTICLE_CRONS' as const, name: 'Scheduled Article Generation', priceMonthly: 19 },
  { code: 'SEARCH_CONSOLE' as const, name: 'Search Console Intelligence', priceMonthly: 29 },
]

async function main() {
  const passwordHash = await argon.hash(TEST_PASSWORD)

  for (const feature of FEATURE_CATALOG) {
    await prisma.feature.upsert({
      where: { code: feature.code },
      update: {},
      create: feature,
    })
  }

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
    const user = await prisma.user.upsert({
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
    if (u.role === 'admin') await prisma.tenantMembership.upsert({
      where: { clientSiteId_userId: { clientSiteId: site.id, userId: user.id } },
      update: {},
      create: { clientSiteId: site.id, userId: user.id, role: 'OWNER', scopes: ['ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS', 'ARTICLE_PUBLISH', 'MEMBER_CONTROL', 'TENANT_SETTINGS', 'INTEGRATION_CONTROL', 'BILLING_CHANGE', 'API_KEY_CONTROL', 'AI_USE', 'ANALYTICS_READ', 'CONTENT_MODERATE'] },
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
