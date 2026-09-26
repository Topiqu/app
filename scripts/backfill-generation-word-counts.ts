import { createDatabaseClient } from '../server/utils/database'
import { generatedWordsFromSnapshot } from '../shared/utils/valueMetrics'

const prisma = createDatabaseClient()
const apply = process.env.APPLY === '1'

async function main() {
  let cursor: string | undefined
  let count = 0
  let words = 0

  while (true) {
    const sessions = await prisma.articleGenerationSession.findMany({
      where: {
        status: 'COMPLETED',
        charged: true,
        completedAt: { not: null },
        generatedWordCount: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, recoverableSnapshot: true },
      orderBy: { id: 'asc' },
      take: 200,
    })
    if (!sessions.length) break

    for (const session of sessions) {
      const generatedWordCount = generatedWordsFromSnapshot(session.recoverableSnapshot)
      if (apply) {
        await prisma.articleGenerationSession.updateMany({
          where: { id: session.id, generatedWordCount: null },
          data: { generatedWordCount },
        })
      }
      count += 1
      words += generatedWordCount
    }
    cursor = sessions.at(-1)!.id
  }

  console.info(`${apply ? 'Backfilled' : 'Would backfill'} ${count} completed sessions (${words} generated words)`)
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
