import { PrismaClient } from '@prisma/client'

import { syncArticlePolls } from '../server/utils/articlePolls'

const APPLY = process.env.APPLY === '1'

const prisma = new PrismaClient()

const main = async () => {
  const articles = await prisma.article.findMany({
    where: { deletedAt: null, content: { contains: 'data-type="poll"' } },
    select: { id: true, slug: true, content: true },
  })

  const stale = articles.filter((a) => {
    const blocks = a.content?.match(/<div[^>]*data-type="poll"[^>]*>/g) ?? []
    return blocks.some((b) => !b.includes('data-poll-id'))
  })

  console.log(`${articles.length} articles with polls, ${stale.length} missing data-poll-id`)
  if (!stale.length) return

  for (const article of stale) {
    if (!APPLY) {
      console.log(`  [dry-run] ${article.slug}`)
      continue
    }
    const content = await syncArticlePolls(prisma as any, article.id, article.content)
    if (content !== article.content) {
      await prisma.article.update({ where: { id: article.id }, data: { content } })
    }
    console.log(`  fixed ${article.slug}`)
  }

  if (!APPLY) console.log('\nDry run. Re-run with APPLY=1 to write.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
