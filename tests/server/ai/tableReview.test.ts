import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(
    import('../../../server/utils/ai/editorialPolicy'),
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/researchEvidence'),
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
}

await stubImports()

const { reviewArticle } = await import('../../../server/utils/ai/articleQuality')

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

beforeEach(() => {
  vi.stubGlobal('aiModel', (task: string) => task)
  vi.mocked(generateText).mockResolvedValue({ output: { approved: true, issues: [] }, usage: {} } as never)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(generateText).mockReset()
})

describe('comparison table review', () => {
  const context = { prompt: 'Porovnej dvě slova', researchBrief: null, verifyFacts: false, modules: ['table'] }
  const draft = {
    title: 'Dvě slova',
    perex: 'Srovnání významů.',
    content:
      '<table><tbody><tr><td>dědek</td><td>starší muž</td></tr><tr><td>kokot</td><td>nadávka</td></tr><tr><td>dědek</td><td>dědeček</td></tr></tbody></table>',
  }

  it('requires a revision even if the AI copy desk approves duplicate subjects', async () => {
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(false)
    expect(result.review.issues).toContainEqual(
      expect.objectContaining({ code: 'broken_structure', note: expect.stringContaining('dědek') }),
    )
  })

  it('approves a table once each subject has one row', async () => {
    const result = await reviewArticle(
      { ...draft, content: draft.content.replace(/<tr><td>dědek<\/td><td>dědeček<\/td><\/tr>/, '') },
      context,
    )
    expect(result.review.approved).toBe(true)
  })
})

describe('story structure review', () => {
  const story = {
    title: 'Johnny Cage na vlakáči',
    perex: 'Co kdyby filmová hvězda zmeškala vlak ve Vsetíně?',
    content: '<h2>Nádraží</h2><p>Cage zaváhal.</p>',
  }

  it('requires a story to narrate a choice instead of listing it, even if the copy desk approves', async () => {
    const result = await reviewArticle(
      { ...story, content: `${story.content}<ul><li>nastoupit</li><li>pomoct</li></ul>` },
      { prompt: 'Příběh', researchBrief: null, verifyFacts: false, format: 'story' },
    )
    expect(result.review.issues).toContainEqual(
      expect.objectContaining({ code: 'broken_structure', note: expect.stringContaining('list') }),
    )
  })
})

beforeEach(stubImports)
