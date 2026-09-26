// Retrieval eval with the real embedding and selection models against a disposable test database.
// Usage: TEST_DATABASE_URL=… NUXT_OPEN_AI_API_KEY=… bun run knowledge:eval
// Fails below the recall / precision / abstention floors, so a threshold change can be measured.
// Recall@K and MRR score the ranked shortlist before the model gate, so a miss can be pinned on
// retrieval or on selection.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createOpenAI } from '@ai-sdk/openai'

import { createDatabaseClient } from '../server/utils/database'
import { AI_EMBEDDING_MODELS, AI_MODELS } from '../server/utils/ai/modelRegistry'

const FLOORS = { recall: 0.9, precision: 0.8, abstention: 0.9 }
const RECALL_AT = [3, 10] as const

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
  /** `indirect`: the topic never names what the source covers. Reported apart and not gated yet. */
  cases: { topic: string; expect: string[]; allow: string[]; indirect?: boolean }[]
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
  let positives = 0
  let reciprocalRanks = 0
  const recallAt = Object.fromEntries(RECALL_AT.map((k) => [k, 0])) as Record<(typeof RECALL_AT)[number], number>
  const indirect = { cases: 0, retrieved: 0, selected: 0 }
  for (const { topic, expect, allow, indirect: isIndirect } of fixture.cases) {
    const result = await retrieveKnowledge(site, topic, { track: false })
    const got = result.used.map((entry) => titles.get(entry.sourceId)!)
    const ranked = [...new Set((result.shortlist ?? []).map((chunk) => titles.get(chunk.sourceId)!))]
    if (isIndirect) {
      const retrieved = expect.every((title) => ranked.slice(0, 10).includes(title))
      const chosen = expect.every((title) => got.includes(title))
      indirect.cases += 1
      indirect.retrieved += Number(retrieved)
      indirect.selected += Number(chosen)
      const verdict = chosen ? 'OK  ' : retrieved ? 'GATE' : 'MISS'
      console.log(`${verdict} [indirect] ${topic}\n     expected ${JSON.stringify(expect)} got ${JSON.stringify(got)}`)
      continue
    }
    if (expect.length) {
      positives += 1
      const first = ranked.findIndex((title) => expect.includes(title))
      reciprocalRanks += first === -1 ? 0 : 1 / (first + 1)
      for (const k of RECALL_AT)
        recallAt[k] += expect.filter((title) => ranked.slice(0, k).includes(title)).length / expect.length
    }
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
  const retrieval = RECALL_AT.map((k) => `recall@${k}: ${(recallAt[k] / positives).toFixed(2)}`)
  console.log(`\nretrieval, before the gate: ${retrieval.join(' · ')} · MRR: ${(reciprocalRanks / positives).toFixed(2)}`)
  if (indirect.cases)
    console.log(
      `indirect relevance (not gated): in top 10 ${indirect.retrieved}/${indirect.cases} · selected ${indirect.selected}/${indirect.cases}`,
    )
  console.log('\n' + Object.entries(scores).map(([name, value]) => `${name}: ${value.toFixed(2)} (floor ${FLOORS[name as keyof typeof FLOORS]})`).join('\n'))
  process.exitCode = Object.entries(scores).every(([name, value]) => value >= FLOORS[name as keyof typeof FLOORS]) ? 0 : 1
} finally {
  await db.clientSite.delete({ where: { id: site } })
  await db.$disconnect()
}
