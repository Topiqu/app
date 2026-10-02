import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reviewArticle } from '../../../server/utils/ai/articleQuality'

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
