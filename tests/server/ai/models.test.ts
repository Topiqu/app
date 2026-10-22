// @vitest-environment node
import { z } from 'zod'
import { generateText, Output } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { aiReasoning } from '../../../server/utils/ai/reasoning'
import { aiModel, aiWebSearchTool } from '../../../server/utils/ai/models'
import { ARTICLE_QUALITY_EFFORT } from '../../../shared/utils/articleQuality'

const { requests } = vi.hoisted(() => ({ requests: [] as { url: string; body: Record<string, any> }[] }))

vi.mock('../../../server/utils/ai/openai', async () => {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return {
    default: createOpenAI({
      apiKey: 'test-key',
      fetch: async (url, init) => {
        const body = JSON.parse(init?.body as string)
        requests.push({ url: String(url), body })
        return new Response(
          JSON.stringify({
            id: 'resp_test',
            created_at: 1,
            model: body.model,
            status: 'completed',
            output: [
              {
                id: 'search_test',
                type: 'web_search_call',
                status: 'completed',
                action: { type: 'search', query: 'test' },
              },
              {
                id: 'message_test',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'output_text', text: '{"title":"Verified"}', annotations: [] }],
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 12,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 2 },
              total_tokens: 22,
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      },
    }),
  }
})

vi.mock('../../../server/utils/ai/anthropic', async () => {
  const { createAnthropic } = await import('@ai-sdk/anthropic')
  return {
    default: createAnthropic({
      apiKey: 'test-key',
      fetch: async (url, init) => {
        const body = JSON.parse(init?.body as string)
        requests.push({ url: String(url), body })
        return new Response(
          JSON.stringify({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            model: body.model,
            content: [
              { type: 'server_tool_use', id: 'srvtoolu_test', name: 'web_search', input: { query: 'test' } },
              {
                type: 'web_search_tool_result',
                tool_use_id: 'srvtoolu_test',
                content: [
                  {
                    type: 'web_search_result',
                    url: 'https://example.com/source',
                    title: 'Source',
                    encrypted_content: 'enc',
                    page_age: null,
                  },
                ],
              },
              { type: 'text', text: '{"title":"Verified"}' },
            ],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 12, server_tool_use: { web_search_requests: 1 } },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      },
    }),
  }
})

describe('AI model integration', () => {
  beforeEach(() => {
    requests.length = 0
  })

  it.each(['articleResearch', 'articleEditor', 'factCheck'] as const)(
    'sends %s to Claude Haiku 5.5 with effort, structured output and web search',
    async (task) => {
      const result = await generateText({
        model: aiModel(task),
        prompt: 'Create a structured answer with a source.',
        output: Output.object({ schema: z.object({ title: z.string() }) }),
        maxOutputTokens: 3000,
        providerOptions: aiReasoning('high'),
        toolChoice: 'required',
        tools: { web_search: aiWebSearchTool(task, 'medium') },
      })

      expect(requests).toHaveLength(1)
      expect(requests[0]?.url).toBe('https://api.anthropic.com/v1/messages')
      expect(requests[0]?.body).toMatchObject({
        model: 'claude-haiku-5-5',
        // The call-site budget plus headroom for adaptive thinking, which shares `max_tokens`.
        max_tokens: 19_000,
        tool_choice: { type: 'any' },
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        output_config: { effort: 'high', format: { type: 'json_schema' } },
      })
      expect(requests[0]?.body).not.toHaveProperty('temperature')
      expect(result.output).toEqual({ title: 'Verified' })
      expect(result.sources.map((source) => source.sourceType === 'url' && source.url)).toEqual([
        'https://example.com/source',
      ])
      expect(result.usage.totalTokens).toBe(22)
    },
  )

  it('writes articles with GPT-6 Luna through Responses with high reasoning and structured output', async () => {
    const result = await generateText({
      model: aiModel('articleWriter'),
      prompt: 'Write an article title.',
      output: Output.object({ schema: z.object({ title: z.string() }) }),
      maxOutputTokens: 8000,
      providerOptions: aiReasoning('high'),
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0]?.body).toMatchObject({
      model: 'gpt-6-luna',
      max_output_tokens: 24_000,
      reasoning: { effort: 'high' },
      text: { format: { type: 'json_schema', strict: true } },
    })
    expect(requests[0]?.body).not.toHaveProperty('temperature')
    expect(result.output).toEqual({ title: 'Verified' })
    expect(result.usage.totalTokens).toBe(22)
  })

  it.each([
    ['STANDARD', 24_000],
    ['HIGH', 40_000],
    ['ULTRA', 72_000],
  ] as const)('writes %s with Luna at its effort and matching thinking headroom', async (quality, maxTokens) => {
    const result = await generateText({
      model: aiModel('articleWriter'),
      prompt: 'Write an article title.',
      output: Output.object({ schema: z.object({ title: z.string() }) }),
      maxOutputTokens: 8000,
      providerOptions: aiReasoning(ARTICLE_QUALITY_EFFORT[quality]),
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0]?.body).toMatchObject({
      model: 'gpt-6-luna',
      max_output_tokens: maxTokens,
      reasoning: { effort: ARTICLE_QUALITY_EFFORT[quality] },
      text: { format: { type: 'json_schema', strict: true } },
    })
    expect(result.output).toEqual({ title: 'Verified' })
  })

  it.each(['translation', 'textEdit', 'promptEnhance', 'linkedinPost', 'backlinkOutreach'] as const)(
    'sends %s to Luna with medium reasoning and room for the complete structured output',
    async (task) => {
      const result = await generateText({
        model: aiModel(task),
        prompt: 'Return a title.',
        output: Output.object({ schema: z.object({ title: z.string() }) }),
        maxOutputTokens: 3000,
        providerOptions: aiReasoning('medium'),
      })

      expect(requests).toHaveLength(1)
      expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
      expect(requests[0]?.body).toMatchObject({
        model: 'gpt-6-luna',
        max_output_tokens: 11_000,
        reasoning: { effort: 'medium' },
        text: { format: { type: 'json_schema', strict: true } },
      })
      expect(result.output).toEqual({ title: 'Verified' })
    },
  )

  it('uses medium reasoning for Haiku helper tasks', async () => {
    await generateText({
      model: aiModel('keywordSeeds'),
      prompt: 'List seeds.',
      maxOutputTokens: 600,
      providerOptions: aiReasoning('medium'),
    })

    expect(requests[0]?.body).toMatchObject({
      max_tokens: 8600,
      output_config: { effort: 'medium' },
    })
  })

  it('does not add headroom when the Anthropic SDK explicitly disables thinking', async () => {
    await generateText({
      model: aiModel('keywordSeeds'),
      prompt: 'List seeds.',
      maxOutputTokens: 600,
      providerOptions: { anthropic: { thinking: { type: 'disabled' }, effort: 'medium' } },
    })

    expect(requests[0]?.body).toMatchObject({
      max_tokens: 600,
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium' },
    })
  })

  it('does not add headroom when an OpenAI SDK call explicitly disables reasoning', async () => {
    await generateText({
      model: aiModel('visibility'),
      prompt: 'Reply with OK.',
      maxOutputTokens: 600,
      providerOptions: { openai: { reasoningEffort: 'none' } },
    })

    expect(requests[0]?.body).toMatchObject({
      max_output_tokens: 600,
      reasoning: { effort: 'none' },
    })
  })

  it('keeps the provider default limit when a caller does not specify an answer budget', async () => {
    await generateText({
      model: aiModel('textEdit'),
      prompt: 'Improve a sentence.',
      providerOptions: aiReasoning('medium'),
    })

    expect(requests[0]?.body).not.toHaveProperty('max_output_tokens')
  })

  it('keeps the ChatGPT visibility probe on OpenAI Responses with OpenAI web search', async () => {
    await generateText({
      model: aiModel('visibility'),
      prompt: 'Answer with a source.',
      providerOptions: aiReasoning('medium'),
      toolChoice: 'required',
      tools: { web_search: aiWebSearchTool('visibility', 'medium') },
    })

    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0]?.body).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
    })
  })
})
