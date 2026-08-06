import { PrismaClient } from '@prisma/client'

const AMOUNT = Number(process.env.SEED_TOKENS ?? 50000)
const url = process.env.DATABASE_URL ?? ''
const host = url.replace(/^[a-z]+:\/\/[^@]*@/, '').split(/[:/]/)[0]

if (!['localhost', '127.0.0.1'].includes(host) && process.env.SEED_FORCE !== '1') {
  console.error(`Odmitam zapisovat do DB na hostu "${host}" — tenhle skript je jen pro lokalni DB.`)
  console.error('Pokud to opravdu chces, spust s SEED_FORCE=1.')
  process.exit(1)
}

const prisma = new PrismaClient()

const sites = await prisma.clientSite.findMany({
  select: { id: true, name: true, plan: true, tokenRemaining: true, generationFrequency: true, lastGeneratedAt: true },
  orderBy: { createdAt: 'asc' },
})

if (!sites.length) {
  console.error('V DB neni zadny ClientSite — nejdriv spust `bun db:fresh` (seed).')
  await prisma.$disconnect()
  process.exit(1)
}

console.log(`DB host: ${host}\nNalezeno ${sites.length} ClientSite:\n`)
for (const s of sites) {
  console.log(
    `  ${s.id}  ${s.name ?? '(bez nazvu)'}  plan=${s.plan}  tokeny=${s.tokenRemaining}  freq=${s.generationFrequency}  lastGen=${s.lastGeneratedAt?.toISOString() ?? 'nikdy'}`,
  )
}

const targetId = process.env.SEED_SITE_ID ?? sites[0]!.id
const target = sites.find((s) => s.id === targetId)
if (!target) {
  console.error(`\nClientSite "${targetId}" v teto DB neexistuje.`)
  await prisma.$disconnect()
  process.exit(1)
}

const updated = await prisma.clientSite.update({
  where: { id: target.id },
  data: {
    tokenRemaining: AMOUNT,
    plan: 'PREMIUM',
    generationFrequency: 'DAILY',
    lastGeneratedAt: null,
  },
  select: { id: true, name: true, plan: true, tokenRemaining: true, generationFrequency: true, lastGeneratedAt: true },
})

console.log(`\nUpraveno: ${updated.id} (${updated.name ?? 'bez nazvu'})`)
console.log(`  tokenRemaining: ${target.tokenRemaining} -> ${updated.tokenRemaining}`)
console.log(`  plan: ${target.plan} -> ${updated.plan}   (PREMIUM zapina web-search grounding)`)
console.log(`  generationFrequency: ${updated.generationFrequency}, lastGeneratedAt: null (cron ho vezme hned)`)

await prisma.$disconnect()
