// @vitest-environment node
import { z } from 'zod'
import { generateText, Output } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { aiModel, aiWebSearchTool } from '../../../server/utils/ai/models'

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

describe('OpenAI model integration', () => {
  beforeEach(() => {
    requests.length = 0
  })

  it.each([
    { task: 'articleResearch', model: 'gpt-5.6-luna' },
    { task: 'articleWriter', model: 'gpt-5.6-luna' },
    { task: 'translation', model: 'gpt-6-luna' },
  ] as const)('uses the configured $model for $task through Responses', async ({ task, model }) => {
    const result = await generateText({
      model: aiModel(task),
      prompt: 'Create a structured answer with a source.',
      output: Output.object({ schema: z.object({ title: z.string() }) }),
      maxOutputTokens: 3000,
      providerOptions: { openai: { reasoningEffort: 'medium' } },
      toolChoice: 'required',
      tools: { web_search: aiWebSearchTool('medium') },
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0]?.body).toMatchObject({
      model,
      reasoning: { effort: 'medium' },
      max_output_tokens: 3000,
      tool_choice: 'required',
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      text: { format: { type: 'json_schema', strict: true, schema: { additionalProperties: false } } },
    })
    expect(result.output).toEqual({ title: 'Verified' })
    expect(result.toolResults.some((tool) => tool.toolName === 'web_search')).toBe(true)
    expect(result.usage.totalTokens).toBe(22)
  })
})
