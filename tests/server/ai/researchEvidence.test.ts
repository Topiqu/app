import { describe, expect, it } from 'vitest'

import {
  filterResearchSources,
  researchEvidence,
  retrievedResearchSources,
} from '../../../server/utils/ai/researchEvidence'

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
