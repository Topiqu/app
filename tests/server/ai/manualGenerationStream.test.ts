import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/generate/index.post.ts'), 'utf8')
const articleGenerator = readFileSync(resolve(process.cwd(), 'server/utils/ai/article.ts'), 'utf8')

describe('manual article generation stream', () => {
  it('leaves transport close events alone and aborts only when the stream reader cancels', () => {
    expect(endpoint).not.toMatch(/event\.node\.req\.on\(['"]close['"]/)
    expect(endpoint).not.toMatch(/event\.node\.res\.on\(['"]close['"]/)
    expect(endpoint).toMatch(/async cancel\([^)]*\)\s*{[\s\S]*abortController\.abort\(\)/)
  })

  it('returns the stream through the Fetch Response contract', () => {
    expect(endpoint).toContain('return new Response(stream, {')
    expect(endpoint).toContain("'Content-Type': 'application/x-ndjson; charset=utf-8'")
    expect(endpoint).not.toContain('setResponseHeader(event')
  })

  it('starts the response before research and keeps Bun from closing an idle generation', () => {
    expect(endpoint.indexOf("phase: options?.research.enabled === false ? 'writing' : 'research'")).toBeLessThan(
      endpoint.indexOf('generation = await streamArticle('),
    )
    expect(endpoint).toMatch(/setInterval\(\(\) => send\(controller, { type: 'heartbeat' }\), 5_000\)/)
    expect(endpoint).toContain('clearInterval(heartbeat)')
  })

  it('bounds both the research wait and writer time to first partial', () => {
    expect(articleGenerator).toContain('standard: { maxOutputTokens: 1200, timeoutMs: 45_000')
    expect(articleGenerator).toContain('AbortSignal.timeout(researchConfig.timeoutMs)')
    expect(articleGenerator).toContain('abortSignal: researchSignal')
    expect(endpoint).toContain("'MANUAL_GENERATION_RESEARCH_STARTED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_WRITER_STARTED'")
    expect(endpoint).toMatch(
      /timedOutStage = 'writer_first_partial'[\s\S]*abortController\.abort\(\)[\s\S]*}, 90_000\)/,
    )
  })

  it('streams truthful phases and passes the selected editorial plan to the generator', () => {
    expect(endpoint).toContain("phase: options?.research.enabled === false ? 'writing' : 'research'")
    expect(endpoint).toContain("send(controller, { type: 'research', ...research })")
    expect(endpoint).toContain("send(controller, { type: 'phase', phase: 'writing' })")
    expect(endpoint).toContain("send(controller, { type: 'phase', phase: 'images' })")
    expect(endpoint).toContain('researchDepth: options?.research.depth')
    expect(endpoint).toContain('fallbackWithoutResearch: options?.research.fallbackWithoutResearch')
    expect(endpoint).toContain('format: options?.format')
    expect(endpoint).toContain('modules: options?.modules')
  })

  it('records the complete manual generation lifecycle with a correlation id', () => {
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_STARTED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_COMPLETED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_FAILED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_ABORTED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_CANCELLED'")
    expect(endpoint).toContain('attemptId')
    expect(endpoint).toMatch(/event,\s*user\.id,\s*\)/)
  })
})
