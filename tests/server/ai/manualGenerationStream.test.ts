import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/generate/index.post.ts'), 'utf8')

describe('manual article generation stream', () => {
  it('leaves transport close events alone and aborts only when the stream reader cancels', () => {
    expect(endpoint).not.toMatch(/event\.node\.req\.on\(['"]close['"]/)
    expect(endpoint).not.toMatch(/event\.node\.res\.on\(['"]close['"]/)
    expect(endpoint).toMatch(/cancel\(\)\s*{[\s\S]*abortController\.abort\(\)/)
  })

  it('returns the stream through the Fetch Response contract', () => {
    expect(endpoint).toContain('return new Response(stream, {')
    expect(endpoint).toContain("'Content-Type': 'application/x-ndjson; charset=utf-8'")
    expect(endpoint).not.toContain('setResponseHeader(event')
  })

  it('records the complete manual generation lifecycle with a correlation id', () => {
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_STARTED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_COMPLETED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_FAILED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_ABORTED'")
    expect(endpoint).toContain('attemptId')
    expect(endpoint).toMatch(/event,\s*user\.id,\s*\)/)
  })
})
