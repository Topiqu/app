// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { emptyWebsiteValues } from '../../../shared/utils/websiteImport'

async function stubImports() {
  await stubNitroImports(
    import('../../../server/utils/ai/articleUsage'),
    'articleEmbeddingUsage',
    'articleImageUsage',
    'articleLanguageUsage',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/modelRegistry'),
    'aiModelId',
    'aiModelProvider',
    'aiEmbeddingModelId',
    'aiImageModelId',
  )
  await stubNitroImports(import('../../../server/utils/ai/models'), 'aiModel')
  await stubNitroImports(import('../../../server/utils/websiteImport/policy'), 'WEBSITE_IMPORT_LIMITS', 'websiteUsage')
  await stubNitroImports(import('../../../server/utils/aiUsage'), 'recordAiUsage')
}

await stubImports()

const { researchWebsite, analyzeWebsite } = await import('../../../server/utils/websiteImport/ai')

const mocks = vi.hoisted(() => ({
  requests: [] as Record<string, unknown>[],
  fail: false,
  text: 'Evidence from the company website.',
  record: vi.fn(),
}))
vi.mock('../../../server/utils/aiUsage', () => ({ recordAiUsage: mocks.record }))
vi.mock('../../../server/utils/ai/openai', async () => {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return { default: createOpenAI({ apiKey: 'synthetic-test-key' }) }
})
vi.mock('../../../server/utils/ai/anthropic', async () => {
  const { createAnthropic } = await import('@ai-sdk/anthropic')
  return {
    default: createAnthropic({
      apiKey: 'synthetic-test-key',
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        mocks.requests.push(body)
        if (mocks.fail)
          return new Response(
            JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'synthetic failure' } }),
            { status: 503, headers: { 'content-type': 'application/json' } },
          )
        return new Response(
          JSON.stringify({
            id: 'msg_synthetic',
            type: 'message',
            role: 'assistant',
            model: body.model,
            content: body.tools
              ? [
                  {
                    type: 'server_tool_use',
                    id: 'srvtoolu_synthetic',
                    name: 'web_search',
                    input: { query: 'site:firma.cz about' },
                  },
                  {
                    type: 'web_search_tool_result',
                    tool_use_id: 'srvtoolu_synthetic',
                    content: [
                      {
                        type: 'web_search_result',
                        url: 'https://firma.cz/about',
                        title: 'About',
                        encrypted_content: 'enc',
                        page_age: null,
                      },
                      {
                        type: 'web_search_result',
                        url: 'https://another.org/private',
                        title: 'Outside',
                        encrypted_content: 'enc',
                        page_age: null,
                      },
                    ],
                  },
                  { type: 'text', text: mocks.text },
                ]
              : [{ type: 'text', text: mocks.text }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              server_tool_use: { web_search_requests: body.tools ? 1 : 0 },
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      },
    }),
  }
})

beforeEach(() => {
  mocks.requests.length = 0
  mocks.fail = false
  mocks.text = 'Evidence from the company website.'
  mocks.record.mockClear()
})

describe('bounded website AI requests', () => {
  it('sends a hard search cap and domain filter, with thinking disabled and no hidden token headroom', async () => {
    const result = await researchWebsite('import-1', 'site-1', 'https://firma.cz/')
    expect(mocks.requests).toHaveLength(1)
    expect(mocks.requests[0]).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2, allowed_domains: ['firma.cz'] }],
    })
    expect(result.urls).toEqual(['https://firma.cz/', 'https://firma.cz/about'])
    expect(result.usage?.searches).toBe(1)
    expect(mocks.record).toHaveBeenCalledWith(
      'site-1',
      150,
      'WEBSITE_IMPORT_SEARCH',
      expect.objectContaining({ importId: 'import-1', searches: 1, usageKnown: true }),
    )
  })
  it('cannot search again during structured extraction', async () => {
    mocks.text = JSON.stringify({ ...emptyWebsiteValues(), focus: 'Výběrová káva a domácí příprava.', language: 'cs' })
    const result = await analyzeWebsite('import-1', 'site-1', {
      language: 'cs',
      research: 'Evidence',
      pages: [],
      metadata: { logoUrls: [], faviconUrls: [], colors: [], socials: [] },
    })
    expect(mocks.requests).toHaveLength(1)
    expect(mocks.requests[0]).not.toHaveProperty('tools')
    expect(mocks.requests[0]).toMatchObject({ max_tokens: 3000, thinking: { type: 'disabled' } })
    expect(result.values.focus).toBe('Výběrová káva a domácí příprava.')
  })
  it('does not retry a failed paid search and records unknown usage honestly', async () => {
    mocks.fail = true
    await expect(researchWebsite('import-1', 'site-1', 'https://firma.cz/')).rejects.toThrow('WEBSITE_SEARCH_FAILED')
    expect(mocks.requests).toHaveLength(1)
    expect(mocks.record).toHaveBeenCalledWith(
      'site-1',
      0,
      'WEBSITE_IMPORT_SEARCH',
      expect.objectContaining({ usageKnown: false, status: 'failed' }),
    )
  })
})

beforeEach(stubImports)
