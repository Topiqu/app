// Retrieval eval with the real embedding and selection models against a disposable test database.
// Usage: TEST_DATABASE_URL=… NUXT_OPEN_AI_API_KEY=… bun run knowledge:eval
// Fails below the recall / precision / abstention floors, so a threshold change can be measured.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createOpenAI } from '@ai-sdk/openai'

import { createDatabaseClient } from '../server/utils/database'
import { AI_EMBEDDING_MODELS, AI_MODELS } from '../server/utils/ai/modelRegistry'

const FLOORS = { recall: 0.9, precision: 0.8, abstention: 0.9 }

const url = process.env.TEST_DATABASE_URL
const apiKey = process.env.NUXT_OPEN_AI_API_KEY || process.env.OPENAI_API_KEY
if (!url || !/test/i.test(new URL(url).pathname) || url === process.env.DATABASE_URL)
  throw new Error('TEST_DATABASE_URL must point at a database whose name contains "test"')
if (!apiKey) throw new Error('Missing NUXT_OPEN_AI_API_KEY')

const db = createDatabaseClient(url)
const openAi = createOpenAI({ apiKey })
Object.assign(globalThis, {
  prisma: db,
  aiModel: (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id),
  aiEmbeddingModel: () => openAi.embedding(AI_EMBEDDING_MODELS.knowledge.id),
  logAction: async () => {},
  reportCaughtError: async (message: string, error: unknown) => console.error(message, error),
})
const { indexKnowledgeSource } = await import('../server/utils/knowledge/indexing')
const { retrieveKnowledge } = await import('../server/utils/knowledge/retrieve')

const fixture = JSON.parse(readFileSync(new URL('./fixtures/knowledge-eval.json', import.meta.url), 'utf8')) as {
  sources: { title: string; content: string }[]
  /** `expect` must be selected; `allow` may be, e.g. pricing in a comparison. Anything else is a false positive. */
  cases: { topic: string; expect: string[]; allow: string[] }[]
}

const site = randomUUID()
await db.clientSite.create({ data: { id: site, name: `knowledge-eval-${site}`, domain: `${site}.test` } })
const titles = new Map<string, string>()
try {
  for (const { title, content } of fixture.sources) {
    const source = await db.knowledgeSource.create({
      data: { clientSiteId: site, kind: 'NOTE', title, content, contentHash: randomUUID().replace(/-/g, '').padEnd(64, '0') },
    })
    if (!(await indexKnowledgeSource(source.id))) throw new Error(`Indexing failed for ${title}`)
    titles.set(source.id, title)
  }

  let expected = 0
  let found = 0
  let selected = 0
  let correct = 0
  let negatives = 0
  let abstained = 0
  for (const { topic, expect, allow } of fixture.cases) {
    const result = await retrieveKnowledge(site, topic, { track: false })
    const got = result.used.map((entry) => titles.get(entry.sourceId)!)
    expected += expect.length
    found += expect.filter((title) => got.includes(title)).length
    selected += got.length
    correct += got.filter((title) => expect.includes(title) || allow.includes(title)).length
    if (!expect.length) {
      negatives += 1
      if (!got.length) abstained += 1
    }
    const ok = expect.every((title) => got.includes(title)) && got.every((title) => expect.includes(title) || allow.includes(title))
    console.log(`${ok ? 'OK  ' : 'MISS'} ${topic}\n     expected ${JSON.stringify(expect)} got ${JSON.stringify(got)}`)
  }

  const scores = {
    recall: expected ? found / expected : 1,
    precision: selected ? correct / selected : 1,
    abstention: negatives ? abstained / negatives : 1,
  }
  console.log('\n' + Object.entries(scores).map(([name, value]) => `${name}: ${value.toFixed(2)} (floor ${FLOORS[name as keyof typeof FLOORS]})`).join('\n'))
  process.exitCode = Object.entries(scores).every(([name, value]) => value >= FLOORS[name as keyof typeof FLOORS]) ? 0 : 1
} finally {
  await db.clientSite.delete({ where: { id: site } })
  await db.$disconnect()
}
