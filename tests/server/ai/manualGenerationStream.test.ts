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

  it('bounds research, writer inactivity, and total writing time', () => {
    expect(articleGenerator).toContain('standard: { maxOutputTokens: 1200, timeoutMs: 45_000')
    expect(articleGenerator).toContain('AbortSignal.timeout(researchConfig.timeoutMs)')
    expect(articleGenerator).toContain('abortSignal: researchSignal')
    expect(endpoint).toContain("'MANUAL_GENERATION_RESEARCH_STARTED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_WRITER_STARTED'")
    expect(endpoint).toContain('30_000 - (now - lastWriterDataAt)')
    expect(endpoint).toContain('90_000 - (now - writerStartedAt)')
    expect(endpoint).toContain('const next = await Promise.race([')
    expect(endpoint).toContain('writerIterator.next()')
    expect(endpoint).toContain('reject(new Error(timeoutStage))')
    expect(endpoint).not.toContain('result.partialObjectStream')
  })

  it('forwards real provider activity without exposing the raw structured output', () => {
    expect(endpoint).toContain("send(controller, { type: 'activity', phase: 'writing', writingStage })")
    expect(endpoint).toContain("send(controller, { type: 'partial', object: partial, writingStage })")
    expect(endpoint).not.toContain('textDelta: part.textDelta')
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
    expect(endpoint).toContain("onMedia: (media) => send(controller, { type: 'media', ...media })")
  })

  it('keeps media finalization observable and cancellable', () => {
    expect(endpoint).toContain('abortSignal: abortController.signal')
    expect(endpoint).toMatch(/async cancel\([^)]*\)\s*{\s*abortController\.abort\(\)/)
    expect(articleGenerator).toContain("onMedia?.({ stage: 'cover'")
    expect(articleGenerator).toContain("stage: 'complete'")
    expect(articleGenerator).toContain('if (!articleImageUrl && object.coverImage)')
  })

  it('grounds time-sensitive claims against the actual generation date', () => {
    expect(articleGenerator).toContain('The current date and time is ${currentDateTime}. Treat it as authoritative.')
    expect(articleGenerator).toContain('Never describe an already elapsed announcement as upcoming.')
    expect(articleGenerator).toContain('Never call a past date upcoming, future or scheduled.')
  })

  it('researches a verified YouTube URL when the author selected the video module', () => {
    expect(articleGenerator).toContain("selectedModulesFor(format, modules).includes('youtube')")
    expect(articleGenerator).toContain('Search specifically for one relevant official or primary-source YouTube video')
    expect(articleGenerator).toContain('The author selected a YouTube video.')
  })

  it('requires matching body image slots when the author selected images', () => {
    expect(articleGenerator).toContain("selectedModules.includes('images')")
    expect(articleGenerator).toContain('The author selected images in the article body.')
    expect(articleGenerator).toContain('Do not return an empty images array.')
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
