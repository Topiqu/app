import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logErrorDetails, sanitizeLogContext } from '../../server/utils/logging'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('BETTERSTACK_SOURCE_TOKEN', '')
  vi.stubEnv('BETTERSTACK_INGEST_HOST', '')
  vi.stubEnv('LOG_LEVEL', 'info')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('structured application logging', () => {
  it('writes one parseable line and protects reserved fields from caller context', async () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { logger } = await import('../../server/utils/logger')
    await logger.warn('Request failed\nwith context', {
      level: 'info',
      message: 'override',
      requestId: 'request-one',
      host: 'blog.example.test',
    })
    expect(output).toHaveBeenCalledOnce()
    expect(output.mock.calls[0]).toHaveLength(1)
    const line = String(output.mock.calls[0]![0])
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toMatchObject({
      level: 'warn',
      message: 'Request failed with context',
      requestId: 'request-one',
      host: 'blog.example.test',
    })
  })

  it('redacts credentials, content and personal records while preserving diagnostic counters', () => {
    vi.stubEnv('SYNTHETIC_API_KEY', 'synthetic-private-api-value')
    const cyclic: Record<string, unknown> = {
      authorization: 'Bearer secret',
      prompt: 'private article',
      apiKey: 'secret',
      user: { email: 'reader@example.test' },
      tokens: 42,
      clientSiteId: 'site-one',
    }
    cyclic.self = cyclic
    const result = JSON.stringify(
      sanitizeLogContext({
        nested: cyclic,
        error: new Error(
          'key synthetic-private-api-value failed: https://service.test/check?token=secret reader@example.test',
        ),
      }),
    )
    for (const secret of [
      'Bearer secret',
      'private article',
      'reader@example.test',
      'synthetic-private-api-value',
      '?token=secret',
    ])
      expect(result).not.toContain(secret)
    expect(result).toContain('"tokens":42')
    expect(result).toContain('site-one')
    expect(result).toContain('[circular]')
  })

  it('keeps error name, code, stack and immediate cause without dumping provider response objects', () => {
    const error = Object.assign(new Error('Provider unavailable', { cause: new Error('Connection refused') }), {
      code: 'ECONNREFUSED',
      response: { body: 'private' },
    })
    expect(logErrorDetails(error)).toMatchObject({
      name: 'Error',
      message: 'Provider unavailable',
      code: 'ECONNREFUSED',
      cause: { name: 'Error', message: 'Connection refused' },
      stack: expect.stringContaining('logger.test.ts'),
    })
    expect(JSON.stringify(logErrorDetails(error))).not.toContain('private')
  })

  it('serializes plain-object causes with useful fields without including provider payloads', () => {
    const error = new Error('Request failed', {
      cause: {
        message: 'Connection refused',
        code: 'ECONNREFUSED',
        statusCode: 503,
        headers: { authorization: 'Bearer private-value' },
        data: { content: 'private provider response' },
      },
    })
    const details = logErrorDetails(error)
    expect(details.cause).toEqual({
      name: 'Error',
      message: 'Connection refused',
      code: 'ECONNREFUSED',
      statusCode: 503,
    })
    expect(JSON.stringify(details)).not.toMatch(/private|\[object Object\]/)
  })

  it('bounds cyclic and deeply nested error causes', () => {
    const circular = new Error('Circular cause')
    circular.cause = circular
    expect(JSON.stringify(logErrorDetails(circular))).toContain('[circular]')
    let chain = new Error('Deepest error')
    for (let index = 0; index < 10; index++) chain = new Error(`Failure ${index}`, { cause: chain })
    const details = JSON.stringify(logErrorDetails(chain))
    expect(details).toContain('[truncated]')
    expect(details).not.toContain('Deepest error')
  })

  it('can omit stacks throughout an expected error cause chain', () => {
    const details = logErrorDetails(new Error('Invalid credentials', { cause: new Error('Password mismatch') }), {
      includeStack: false,
    })
    expect(details).toMatchObject({ message: 'Invalid credentials', cause: { message: 'Password mismatch' } })
    expect(JSON.stringify(details)).not.toContain('stack')
  })

  it('redacts raw network identity fields centrally while retaining a pseudonymous fingerprint', () => {
    const context = sanitizeLogContext({
      ip: '203.0.113.4',
      ipAddress: '2001:db8::1',
      userAgent: 'Synthetic Browser/123',
      nested: { client_ip: '203.0.113.4', 'user-agent': 'Synthetic Browser/123', 'x-forwarded-for': '203.0.113.4' },
      ipFingerprint: 'synthetic-fingerprint',
      requestId: 'request-one',
    })
    expect(JSON.stringify(context)).not.toMatch(/203\.0\.113\.4|2001:db8::1|Synthetic Browser/)
    expect(context).toMatchObject({
      ip: '[redacted]',
      ipFingerprint: 'synthetic-fingerprint',
      requestId: 'request-one',
    })
  })

  it('suppresses successful debug reads by default and permits explicit debug mode', async () => {
    const output = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { logger } = await import('../../server/utils/logger')
    await logger.debug('Poll completed')
    expect(output).not.toHaveBeenCalled()
    vi.stubEnv('LOG_LEVEL', 'debug')
    await logger.debug('Poll completed')
    expect(output).toHaveBeenCalledOnce()
  })
})
