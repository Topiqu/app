// @vitest-environment node

import { generateText } from 'ai'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({ apiKey: '' as string | undefined }))
mockNuxtImport('useRuntimeConfig', () => () => ({ anthropic: config }))

const requests: Headers[] = []
const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  requests.push(headers)
  const body = headers.get('x-api-key')
    ? {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [{ type: 'text', text: 'OK' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 3, output_tokens: 1 },
      }
    : { type: 'error', error: { type: 'authentication_error', message: 'x-api-key header is required' } }
  return new Response(JSON.stringify(body), {
    status: headers.get('x-api-key') ? 200 : 401,
    headers: { 'content-type': 'application/json' },
  })
})

beforeEach(() => {
  vi.resetModules()
  fetch.mockClear()
  requests.length = 0
  config.apiKey = ''
  vi.stubEnv('ANTHROPIC_API_KEY', 'runtime-only-test-key')
  vi.stubGlobal('anthropicGlobal', undefined)
  vi.stubGlobal('fetch', fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const generate = async () => {
  const { default: anthropic } = await import('../../../server/utils/ai/anthropic')
  return generateText({
    model: anthropic('claude-haiku-5-5'),
    prompt: 'Reply with OK.',
    maxOutputTokens: 32,
    maxRetries: 0,
  })
}

describe('Anthropic authentication with runtime-only container secrets', () => {
  it.each(['', undefined, '   '])('uses the container key when the built configuration contains %j', async (key) => {
    config.apiKey = key

    await expect(generate()).resolves.toMatchObject({ text: 'OK' })
    expect(requests).toHaveLength(1)
    expect(requests[0]!.get('x-api-key')).toBe('runtime-only-test-key')
  })

  it('preserves an explicit Nuxt runtime override', async () => {
    config.apiKey = 'nuxt-override-test-key'

    await expect(generate()).resolves.toMatchObject({ text: 'OK' })
    expect(requests[0]!.get('x-api-key')).toBe('nuxt-override-test-key')
  })

  it('supports a configured key without the SDK environment variable', async () => {
    config.apiKey = 'configured-test-key'
    vi.stubEnv('ANTHROPIC_API_KEY', undefined)

    await expect(generate()).resolves.toMatchObject({ text: 'OK' })
    expect(requests[0]!.get('x-api-key')).toBe('configured-test-key')
  })

  it('reports a missing key before sending an unauthenticated provider request', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined)

    await expect(generate()).rejects.toThrow('ANTHROPIC_API_KEY')
    expect(fetch).not.toHaveBeenCalled()
  })
})
