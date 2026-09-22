import { describe, expect, it } from 'vitest'

import {
  parseAnthropicResult,
  parseGoogleResult,
  parseMistralResult,
  parseResponsesApiResult,
} from '../../server/utils/ai/visibilityProviderParsing'

describe('AI visibility provider citation parsing', () => {
  it('reads xAI and Meta Responses API citation annotations', () => {
    const result = parseResponsesApiResult({
      output: [
        { type: 'web_search_call' },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Grounded answer',
              annotations: [{ type: 'url_citation', url: 'https://example.com/a', title: 'A' }],
            },
          ],
        },
      ],
      usage: { total_tokens: 42 },
    })

    expect(result).toMatchObject({
      text: 'Grounded answer',
      searchedWeb: true,
      totalTokens: 42,
      sources: [{ sourceType: 'url', url: 'https://example.com/a', title: 'A' }],
    })
  })

  it('uses only citations attached to Claude text, not every retrieved result', () => {
    const result = parseAnthropicResult({
      content: [
        { type: 'server_tool_use', name: 'web_search' },
        { type: 'web_search_tool_result' },
        {
          type: 'text',
          text: 'Claude answer',
          citations: [
            { type: 'web_search_result_location', url: 'https://example.com/claude', title: 'Claude source' },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 12 },
    })

    expect(result.searchedWeb).toBe(true)
    expect(result.totalTokens).toBe(22)
    expect(result.sources).toHaveLength(1)
  })

  it('keeps only Gemini grounding chunks referenced by grounding supports', () => {
    const result = parseGoogleResult({
      candidates: [
        {
          content: { parts: [{ text: 'Gemini answer' }] },
          groundingMetadata: {
            webSearchQueries: ['query'],
            groundingChunks: [
              { web: { uri: 'https://example.com/cited', title: 'Cited' } },
              { web: { uri: 'https://example.com/retrieved-only', title: 'Retrieved only' } },
            ],
            groundingSupports: [{ groundingChunkIndices: [0] }],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 33 },
    })

    expect(result.searchedWeb).toBe(true)
    expect(result.sources.map((source) => source.url)).toEqual(['https://example.com/cited'])
  })

  it('extracts Mistral tool references separately from answer text', () => {
    const result = parseMistralResult({
      outputs: [
        { type: 'tool.execution', name: 'web_search' },
        {
          type: 'message.output',
          content: [
            { type: 'text', text: 'Mistral answer' },
            { type: 'tool_reference', url: 'https://example.com/mistral', title: 'Mistral source' },
          ],
        },
      ],
      usage: { total_tokens: 51 },
    })

    expect(result).toMatchObject({
      text: 'Mistral answer',
      searchedWeb: true,
      totalTokens: 51,
      sources: [{ sourceType: 'url', url: 'https://example.com/mistral', title: 'Mistral source' }],
    })
  })
})
