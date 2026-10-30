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

describe('story and video structure review', () => {
  const story = {
    title: 'Johnny Cage na vlakáči',
    perex: 'Co kdyby filmová hvězda zmeškala vlak ve Vsetíně?',
    content: '<h2>Nádraží</h2><p>Cage zaváhal.</p>',
  }
  const verifiedVideo = 'Brief.\nVerified YouTube video (checked against YouTube oEmbed): https://youtu.be/abc'

  it('requires a story to narrate a choice instead of listing it, even if the copy desk approves', async () => {
    const result = await reviewArticle(
      { ...story, content: `${story.content}<ul><li>nastoupit</li><li>pomoct</li></ul>` },
      { prompt: 'Příběh', researchBrief: null, verifyFacts: false, format: 'story' },
    )
    expect(result.review.issues).toContainEqual(
      expect.objectContaining({ code: 'broken_structure', note: expect.stringContaining('list'), key: 'storyList' }),
    )
  })

  it('asks the copy desk for notes in the interface language only when one is given', async () => {
    vi.stubGlobal('LANGUAGE_NAMES', { cs: 'Czech' })
    const context = { prompt: 'Příběh', researchBrief: null, verifyFacts: false, format: 'story' }
    await reviewArticle(story, { ...context, noteLanguage: 'cs' as const })
    await reviewArticle(story, context)
    const [localized, plain] = vi.mocked(generateText).mock.calls.map((call) => call[0].instructions as string)
    expect(localized).toContain('Write every note in Czech')
    expect(plain).not.toContain('Write every note in')
  })

  it('owes a requested video only when research verified one', async () => {
    const context = { prompt: 'Příběh', verifyFacts: false, format: 'story', modules: ['youtube'] }
    expect((await reviewArticle(story, { ...context, researchBrief: 'Brief.' })).review.approved).toBe(true)

    const missing = await reviewArticle(story, { ...context, researchBrief: verifiedVideo })
    expect(missing.review.issues).toContainEqual(
      expect.objectContaining({
        code: 'broken_structure',
        note: expect.stringContaining('[[VIDEO1]]'),
        key: 'module.youtube',
      }),
    )

    const embedded = { ...story, content: `${story.content}[[VIDEO1]]`, videos: [{ url: 'https://youtu.be/abc' }] }
    expect((await reviewArticle(embedded, { ...context, researchBrief: verifiedVideo })).review.approved).toBe(true)
  })
})

beforeEach(stubImports)
