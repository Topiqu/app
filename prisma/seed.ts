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
    update: {
      domain: 'localhost',
      domainVerified: true,
      language: 'cs',
      tagline: 'Praktické poznatky pro digitální redakce',
      typographyPreset: 'MODERN',
    },
    create: {
      name: 'topiqu-dev',
      domain: 'localhost',
      domainVerified: true,
      plan: 'BASIC',
      language: 'cs',
      tokenLimit: 20000,
      tokenRemaining: 20000,
      tagline: 'Praktické poznatky pro digitální redakce',
      typographyPreset: 'MODERN',
    },
  })

  await prisma.clientSite.upsert({
    where: { name: 'topiqu-empty' },
    update: {
      domain: 'empty.localhost',
      domainVerified: true,
      language: 'cs',
      tagline: 'Nový prostor pro dobré čtení',
      typographyPreset: 'MODERN',
    },
    create: {
      name: 'topiqu-empty',
      domain: 'empty.localhost',
      domainVerified: true,
      description: 'Nová publikace připravená pro první článek.',
      plan: 'BASIC',
      language: 'cs',
      theme: 'indigo',
      tokenLimit: 20000,
      tokenRemaining: 20000,
      tagline: 'Nový prostor pro dobré čtení',
      typographyPreset: 'MODERN',
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
      update: {
        username: u.username,
        password: passwordHash,
        role: u.role,
        emailVerified: true,
        language: 'cs',
        clientSiteId: 'clientSiteId' in u ? u.clientSiteId : null,
      },
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
    if (u.role === 'admin')
      await prisma.tenantMembership.upsert({
        where: { clientSiteId_userId: { clientSiteId: site.id, userId: user.id } },
        update: {},
        create: {
          clientSiteId: site.id,
          userId: user.id,
          role: 'OWNER',
          scopes: [
            'ARTICLE_WRITE',
            'ARTICLE_WRITE_OTHERS',
            'ARTICLE_PUBLISH',
            'MEMBER_CONTROL',
            'TENANT_SETTINGS',
            'INTEGRATION_CONTROL',
            'BILLING_CHANGE',
            'API_KEY_CONTROL',
            'AI_USE',
            'ANALYTICS_READ',
            'CONTENT_MODERATE',
          ],
        },
      })
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@test.local' } })
  const reader = await prisma.user.findUniqueOrThrow({ where: { email: 'reader@test.local' } })

  await prisma.clientSite.update({
    where: { id: site.id },
    data: {
      description: 'Praktické poznatky o tvorbě obsahu, technologiích a růstu digitálních publikací.',
      focus: 'Obsahový marketing a technologie',
      audience: 'Redakční a marketingové týmy',
      keywords: ['obsah', 'publikování', 'technologie'],
      theme: 'indigo',
    },
  })

  const series = await prisma.articleSeries.upsert({
    where: { id: '10000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Průvodce moderní redakcí',
      slug: 'pruvodce-moderni-redakci',
      description: 'Od prvního nápadu po dlouhodobě udržitelnou publikaci.',
      clientSiteId: site.id,
    },
  })

  const fixtureArticles = [
    {
      id: '20000000-0000-4000-8000-000000000001',
      slug: 'jak-postavit-udrzitelnou-redakci',
      title: 'Jak postavit udržitelnou digitální redakci',
      excerpt: 'Praktický rámec pro plánování, tvorbu a vyhodnocování obsahu bez zbytečného provozního chaosu.',
      imageUrl: '/topik_normal_rm.png',
      views: 1284,
      readingTime: 7,
      seriesOrder: 1,
      content:
        '<h2>Začněte jasným redakčním záměrem</h2><p>Dobrá publikace nevzniká množstvím textů, ale konzistentním rozhodováním o tom, komu pomáhá a proč. Sepište si témata, která umíte dlouhodobě pokrývat, a spojte je s konkrétními potřebami čtenářů.</p><h2>Navrhněte jednoduchý pracovní tok</h2><p>Každý článek by měl projít stejnými kroky: zadání, návrh, odborná kontrola, jazyková úprava a publikování. Stav práce musí být čitelný pro celý tým bez dalších tabulek.</p><h3>Měřte užitek, ne jen návštěvnost</h3><p>Sledujte, zda čtenář pokračuje k souvisejícímu článku, reaguje nebo se vrací. Teprve tyto signály ukazují, že obsah skutečně funguje.</p>',
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      slug: 'obsahovy-plan-ktery-tym-pouziva',
      title: 'Obsahový plán, který tým skutečně používá',
      excerpt: 'Méně sloupců, jasnější odpovědnost a prostor reagovat na to, co se právě děje.',
      imageUrl: '/topik_premysli_rm.png',
      views: 842,
      readingTime: 5,
      seriesOrder: 2,
      content:
        '<h2>Plán je dohoda</h2><p>Redakční plán má týmu pomáhat rozhodovat, nikoli vytvářet další administrativu. U každého tématu stačí vlastník, cílový čtenář, stav a zamýšlený termín.</p><h2>Nechte místo pro změnu</h2><p>Část kapacity držte volnou pro aktuální témata a poznatky od zákazníků. Díky tomu publikace neztratí kontakt s realitou.</p>',
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      slug: 'pristupny-clanek-od-prvniho-nadpisu',
      title: 'Přístupný článek od prvního nadpisu',
      excerpt: 'Čitelnost, struktura a popisy médií nejsou poslední kontrola, ale součást dobrého redakčního řemesla.',
      imageUrl: '/missing-fixture-image.webp',
      views: 416,
      readingTime: 4,
      seriesOrder: 3,
      content:
        '<h2>Struktura vede čtenáře</h2><p>Nadpisy mají vysvětlovat vztahy mezi částmi textu. Krátké odstavce, popisné odkazy a smysluplný alternativní text pomáhají všem čtenářům.</p>',
    },
  ]

  for (const [index, article] of fixtureArticles.entries()) {
    await prisma.article.upsert({
      where: { id: article.id },
      update: { ...article, allowedComments: true, status: 'published' },
      create: {
        ...article,
        userId: admin.id,
        clientSiteId: site.id,
        articleSeriesId: series.id,
        status: 'published',
        publishedAt: new Date(Date.UTC(2026, 7, 10 - index, 9, 0)),
        sources: ['https://www.w3.org/WAI/'],
        allowedComments: true,
        totalWords: article.content.split(/\s+/).length,
      },
    })
  }

  const tag = await prisma.tag.upsert({
    where: { id: '30000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Redakce',
      slug: 'redakce',
      clientSiteId: site.id,
    },
  })

  for (const article of fixtureArticles) {
    await prisma.articleTag.upsert({
      where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
      update: {},
      create: { articleId: article.id, tagId: tag.id },
    })
  }

  await prisma.comment.upsert({
    where: { id: '40000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '40000000-0000-4000-8000-000000000001',
      content: 'Srozumitelný postup. Nejvíc nám pomohlo sjednotit stavy rozpracovaných článků.',
      articleId: fixtureArticles[0]!.id,
      userId: reader.id,
      sentimentStatus: 'PROCESSED',
      sentiment: { label: 'positive', score: 0.92 },
    },
  })

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
