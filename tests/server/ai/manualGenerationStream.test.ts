import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/generate/index.post.ts'), 'utf8')
const articleGenerator = readFileSync(resolve(process.cwd(), 'server/utils/ai/article.ts'), 'utf8')
const articleConfig = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleConfig.ts'), 'utf8')
const articleMedia = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleMedia.ts'), 'utf8')
const articleResearch = readFileSync(resolve(process.cwd(), 'server/utils/ai/researchEvidence.ts'), 'utf8')
const articleQuality = readFileSync(resolve(process.cwd(), 'server/utils/ai/articleQuality.ts'), 'utf8')
const editor = readFileSync(resolve(process.cwd(), 'app/pages/admin/editor/[id].vue'), 'utf8')
const drafts = readFileSync(resolve(process.cwd(), 'app/composables/useArticleDrafts.ts'), 'utf8')
const recovery = readFileSync(resolve(process.cwd(), 'server/utils/articleGenerationRecovery.ts'), 'utf8')
const store = readFileSync(resolve(process.cwd(), 'app/stores/articleGeneration.ts'), 'utf8')
const stopEndpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/generations/[id]/stop.post.ts'), 'utf8')

describe('manual article generation stream', () => {
  it('keeps generating after a disconnect and aborts only after an explicit Stop request', () => {
    expect(endpoint).not.toMatch(/event\.node\.req\.on\(['"]close['"]/)
    expect(endpoint).not.toMatch(/event\.node\.res\.on\(['"]close['"]/)
    expect(endpoint).toContain("if (session?.failureReason !== 'USER_STOP_REQUESTED') return")
    expect(stopEndpoint).toContain("data: { failureReason: 'USER_STOP_REQUESTED' }")
    expect(store).toContain('await $fetch(`/api/articles/generations/${sessionId.value}/stop`')
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
    expect(articleResearch).toContain('standard: { maxOutputTokens: 5000, timeoutMs: 90_000')
    expect(articleResearch).toContain('AbortSignal.timeout(researchConfig.timeoutMs)')
    expect(articleResearch).toContain('abortSignal: researchSignal')
    expect(endpoint).toContain("'MANUAL_GENERATION_RESEARCH_STARTED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_WRITER_STARTED'")
    expect(endpoint).toContain('45_000 - (now - lastWriterDataAt)')
    expect(endpoint).toContain('120_000 - (now - writerStartedAt)')
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
    expect(endpoint).toContain("send(controller, { type: 'research', ...research, sources: researchSources })")
    expect(endpoint).toContain("send(controller, { type: 'phase', phase: 'writing' })")
    expect(endpoint).toContain("send(controller, { type: 'phase', phase: 'images' })")
    expect(endpoint).toContain('researchDepth: options?.research.depth')
    expect(endpoint).toContain('fallbackWithoutResearch: options?.research.fallbackWithoutResearch')
    expect(endpoint).toContain('format: options?.format')
    expect(endpoint).toContain('modules: options?.modules')
    expect(endpoint).toContain('allowGeneratedImages: options?.allowGeneratedImages !== false')
    expect(endpoint).toContain("onMedia: (media) => send(controller, { type: 'media', ...media })")
  })

  it('uses the selected editor language for the generated article', () => {
    expect(editor).toContain('language: primaryLanguage.value')
    expect(endpoint).toContain('language: options?.language')
    expect(articleConfig).toContain('const articleLanguage = requestedLanguage ?? language')
    expect(articleConfig).toContain('LANGUAGE_NAMES[articleLanguage]')
  })

  it('keeps researched and partially generated sources when the author stops early', () => {
    expect(articleConfig).toContain('researchSources: researchResult.sources')
    expect(endpoint).toContain("type: 'research', ...research, sources: researchSources")
    expect(store).toContain('onResearch: (research) => update({ sources: research.sources })')
    expect(store).toContain('...(partial.sources != null ? { sources: partial.sources } : {})')
  })

  it('pauses autosave while generation mutates the editor and saves once afterward', () => {
    expect(drafts).toContain('if (!force && (idle.value || options.paused?.value)) return false')
    expect(editor).toContain('paused: aiGenerating')
    expect(editor).toMatch(
      /watch\(aiGenerating, \(now, before\) => \{\s+if \(now \|\| !before\) return\s+retryOptimization\(\)\s+if \(isNew\) void saveDraftNow\(\)/,
    )
  })

  it('couples interrupted billing to a durable useful recovery checkpoint', () => {
    expect(endpoint).toContain('hasUsefulGenerationSnapshot(recoverySnapshot)')
    expect(endpoint.indexOf("checkpointGeneration(recoverySession!.id, 'final'")).toBeLessThan(
      endpoint.indexOf('settleArticleCredit(articleReservation, chargeInterrupted'),
    )
    expect(recovery).toContain('billing and recovery are inseparable')
  })

  it('keeps media finalization observable and cancellable', () => {
    expect(endpoint).toContain('abortSignal: abortController.signal')
    expect(endpoint).toMatch(
      /if \(session\?\.failureReason !== 'USER_STOP_REQUESTED'\) return\s+abortController\.abort\(\)/,
    )
    expect(articleMedia).toContain("reportMedia('cover')")
    expect(articleMedia).toContain("reportMedia('complete')")
    expect(endpoint).toContain("send(controller, { type: 'media', stage: 'failed'")
    expect(articleMedia).not.toContain('if (!articleImageUrl && firstBodyImage)')
  })

  it('grounds time-sensitive claims against the actual generation date', () => {
    expect(articleResearch).toContain('The current date and time is ${currentDateTime}. Treat it as authoritative.')
    expect(articleResearch).toContain('Never describe an already elapsed announcement as upcoming.')
    expect(articleConfig).toContain('Never call a past date upcoming, future or scheduled.')
  })

  it('keeps strict verification out of the published article voice and revision', () => {
    expect(articleConfig).toContain('Fact-checking is an internal editing discipline, not the voice of the article.')
    expect(articleConfig).toContain('correct it once in plain language')
    expect(articleQuality).toContain('Keep the verification process out of the published voice.')
  })

  it('researches a verified YouTube URL when the author selected the video module', () => {
    expect(articleConfig).toContain("selectedModules?.includes('youtube')")
    expect(articleResearch).toContain('Search for existing, directly relevant YouTube videos')
    expect(articleResearch).toContain('https://www.youtube.com/oembed')
    expect(articleResearch).toContain('youtubeVideoId(candidate)')
    expect(articleConfig).toContain('The author selected a YouTube video.')
  })

  it('streams the authoritative article balance after settlement', () => {
    expect(endpoint).toContain("type: 'billing', articlesCharged: 1, articlesRemaining: articleWallet.available")
  })

  it('holds one customer-visible article and logs provider usage separately', () => {
    expect(endpoint).toContain("reserveArticleCredit(clientSiteId, 'MANUAL_ARTICLE'")
    expect(endpoint).toContain("send(controller, { type: 'reservation', articles: 1 })")
    expect(endpoint).toContain("'MANUAL_GENERATION_COMPLETED'")
    expect(endpoint).not.toContain('reserveTokens')
  })

  it('stamps every billed run with the options and models that drove its cost', () => {
    expect(endpoint).toContain('researchDepth: options?.research.enabled ? options.research.depth : null')
    expect(endpoint).toContain("models: { research: aiModelId('articleResearch'), writer: aiModelId('articleWriter') }")
    // Completed and aborted both bill, so both have to be attributable.
    expect(endpoint.match(/\.\.\.runConfig,/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('requires matching body image slots when the author selected images', () => {
    expect(articleConfig).toContain("selectedModules.includes('images')")
    expect(articleConfig).toContain('The author explicitly requested images in the article body.')
    expect(articleConfig).toContain('This is a requested deliverable: never return an empty images array.')
  })

  it('uses the same constraints for generation and deterministic optimization', () => {
    expect(articleConfig).toContain('articleGenerationOptimizationInstructions(domain)')
    expect(articleConfig).toContain('.min(optimizationCriteria.titleCharacters.minimum)')
    expect(articleConfig).toContain('.max(optimizationCriteria.excerptCharacters.maximum)')
    expect(articleMedia).toContain("buildImageHtml(registered, '', labels)")
  })

  it('treats an explicitly selected poll as a deliverable', () => {
    expect(articleConfig).toContain('Never return an empty polls array when the poll module is selected.')
    expect(articleQuality).toMatch(/requireModule\(\s*'poll'/)
    expect(articleQuality).toMatch(/requireModule\(\s*'images'/)
  })

  it('records the complete manual generation lifecycle with a correlation id', () => {
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_STARTED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_COMPLETED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_FAILED'")
    expect(endpoint).toContain("'MANUAL_GENERATION_ABORTED'")
    expect(endpoint).toContain("auditAttempt('MANUAL_GENERATION_CANCELLED'")
    expect(endpoint).toContain('attemptId')
    expect(endpoint).toContain('modules: options?.modules ?? []')
    expect(endpoint).toMatch(/event,\s*user\.id,\s*\)/)
  })

  it('tries retrieved YouTube alternatives before reporting the module unavailable', () => {
    expect(articleResearch).toContain('Return up to three full youtube.com/watch or youtu.be URLs')
    expect(articleResearch).toContain('for (const url of urls)')
    expect(articleResearch).toContain('retrievedResearchSources(result)')
  })

  it('discovers official media pages during research instead of using a publisher allowlist', () => {
    expect(articleResearch).toContain('OFFICIAL MEDIA: <owner>')
    expect(articleConfig).toContain('officialMediaPages')
    expect(articleMedia).toContain('findPressImage')
    expect(articleMedia).toContain('youtubeThumbnailImage')
    expect(articleMedia).not.toContain('press.cdprojektred.com')
  })

  it('checks revised copy before reporting its review and proceeding to media finalization', () => {
    expect(endpoint).toContain("send(controller, { type: 'review', review: generation.editorialReview })")
    const streamImplementation = articleGenerator.slice(articleGenerator.indexOf('export const streamArticle'))
    expect(streamImplementation.match(/reviewArticle\(/g)).toHaveLength(2)
    expect(streamImplementation).toContain('...checked.review')
    expect(streamImplementation).toContain('checkedAfterRevision: true')
  })
})
