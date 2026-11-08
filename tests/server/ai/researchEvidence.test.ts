import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
}

await stubImports()

const { filterResearchSources, researchEvidence, researchTopic, retrievedResearchSources } =
  await import('../../../server/utils/ai/researchEvidence')
const { youtubeVideoId } = await import('../../../shared/utils/youtube')

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText,
}))

describe('research evidence', () => {
  it('uses provider search results and opened pages when there are no inline citations', () => {
    const searchUrl = 'https://publisher.test/announcement'
    const openedUrl = 'https://publisher.test/interview'
    const sources = retrievedResearchSources({
      sources: [],
      toolResults: [
        { toolName: 'web_search', output: { sources: [{ type: 'url', url: searchUrl }] } },
        { toolName: 'web_search', output: { action: { type: 'openPage', url: openedUrl } } },
        { toolName: 'untrusted_tool', output: { sources: [{ type: 'url', url: 'https://invented.test/' }] } },
      ],
    })
    expect(researchEvidence(`The event was explicitly confirmed. ${openedUrl}`, sources).urls).toEqual([openedUrl])
    expect(sources.map((source) => source.url)).toEqual([searchUrl, openedUrl])
  })
  it('accepts retrieved URLs wrapped in Markdown code spans and links', () => {
    const url = 'https://publisher.test/interview'
    const line = `The developers confirmed the event. \`${url}\` ([publisher](${url}))`
    expect(researchEvidence(line, [{ sourceType: 'url', url }])).toEqual({ brief: line, urls: [url] })
    expect(filterResearchSources([url], line)).toEqual([url])
  })
  it('retains only facts tied to provider-returned source URLs', () => {
    const verified = 'https://publisher.test/interview'
    const result = researchEvidence(
      [
        `Confirmed event; mechanism undisclosed. ${verified}`,
        'Invented confirmation. https://publisher.test/guessed',
        'A character will return without any evidence.',
      ].join('\n'),
      [{ sourceType: 'url', url: verified }],
    )
    expect(result).toEqual({ brief: `Confirmed event; mechanism undisclosed. ${verified}`, urls: [verified] })
  })

  it('does not trust source URLs merely written by the model', () => {
    expect(researchEvidence('A fact https://publisher.test/interview', [])).toEqual({ brief: null, urls: [] })
  })

  it('does not report a source list without facts as completed grounding', () => {
    const url = 'https://publisher.test/interview'
    expect(researchEvidence(`Sources:\n- ${url}`, [{ sourceType: 'url', url }]).brief).toBeNull()
  })

  it('retains a short official-media owner only when the provider retrieved its page', () => {
    const url = 'https://ea.com/games/example/media'
    const line = `OFFICIAL MEDIA: EA — ${url}`
    expect(researchEvidence(line, [{ sourceType: 'url', url }])).toEqual({ brief: line, urls: [url] })
    expect(researchEvidence(line, [])).toEqual({ brief: null, urls: [] })
  })

  it('removes fabricated writer citations and duplicates', () => {
    const url = 'https://publisher.test/interview'
    expect(filterResearchSources([url, url, 'https://publisher.test/guessed'], `Confirmed: ${url}`)).toEqual([url])
    expect(filterResearchSources([url], null)).toEqual([])
  })
})

it('splits concatenated model citations while retaining only retrieved URLs', () => {
  const a = 'https://publisher.test/a',
    b = 'https://publisher.test/b'
  expect(filterResearchSources([a + b + '  https://invented.test/c'], a + ' ' + b)).toEqual([a, b])
})

describe('research topic', () => {
  const video = 'https://www.youtube.com/watch?v=HLrvinbWx3w'
  const isVideoSearch = (options: { maxOutputTokens?: number }) => options.maxOutputTokens === 250
  const videoFound = { text: video, sources: [], toolResults: [], usage: { totalTokens: 600 }, finishReason: 'stop' }

  beforeEach(() => {
    generateText.mockReset()
    vi.stubGlobal('aiModel', () => 'model')
    vi.stubGlobal('aiWebSearchTool', () => ({}))
    vi.stubGlobal('youtubeVideoId', youtubeVideoId)
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ title: 'Zátop v kotli' }))),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps a verified video when the brief fails, under the no-research rule', async () => {
    generateText.mockImplementation(async (options) => {
      if (isVideoSearch(options)) return videoFound
      throw new Error('provider overloaded')
    })

    const result = await researchTopic('Atmos DC 25 S', 'standard', true, undefined, true)

    expect(result).toMatchObject({
      status: 'fallback',
      fallbackReason: 'error',
      youtube: { status: 'found', url: video, title: 'Zátop v kotli' },
      tokens: 600,
    })
    expect(result.brief?.split('\n')).toEqual([
      expect.stringMatching(/^No live research was available\./),
      `Verified YouTube video (checked against YouTube oEmbed): ${video}`,
    ])
  })

  it('appends the video to a supported brief', async () => {
    const page = 'https://www.atmos.eu/produkt/dc25s'
    generateText.mockImplementation(async (options) =>
      isVideoSearch(options)
        ? videoFound
        : {
            text: `The DC 25 S is rated at 27 kW in emission class 5. ${page}`,
            sources: [{ sourceType: 'url', url: page }],
            toolResults: [],
            usage: { totalTokens: 9000 },
            finishReason: 'stop',
          },
    )

    const result = await researchTopic('Atmos DC 25 S', 'standard', true, undefined, true)

    expect(result.status).toBe('completed')
    expect(result.brief).toBe(
      `The DC 25 S is rated at 27 kW in emission class 5. ${page}\nVerified YouTube video (checked against YouTube oEmbed): ${video}`,
    )
    expect(result.tokens).toBe(9600)
  })

  it('asks the video search to look up videos, not to answer the topic', async () => {
    generateText.mockImplementation(async (options) => {
      if (isVideoSearch(options)) return videoFound
      throw new Error('provider overloaded')
    })

    await researchTopic('Vyplatí se kotel Atmos DC 25 S?', 'standard', true, undefined, true)

    const search = generateText.mock.calls.map(([options]) => options).find(isVideoSearch)
    expect(search.prompt).toMatch(/^Article topic: Vyplatí se kotel Atmos DC 25 S\?\n/)
    expect(search.prompt).toContain('Do not answer the topic itself')
  })
})

beforeEach(stubImports)
