import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runner = readFileSync(resolve(process.cwd(), 'server/utils/ai/visibility.ts'), 'utf8')
const providers = readFileSync(resolve(process.cwd(), 'server/utils/ai/visibilityProviderRunner.ts'), 'utf8')
const crawlerPlugin = readFileSync(resolve(process.cwd(), 'server/plugins/crawlerLog.ts'), 'utf8')
const referralEndpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/[id]/view.post.ts'), 'utf8')

describe('AI visibility monitoring contracts', () => {
  it('counts citations only from provider citation sources and forces a web-search run', () => {
    expect(providers).toContain("toolChoice: 'required'")
    expect(runner).toContain('citationRows(result.sources')
    expect(runner).not.toContain('retrievedResearchSources')
  })

  it('runs only configured providers and supports every monitored answer engine', () => {
    expect(providers).toContain('candidate.apiKey.trim()')
    for (const provider of ['OPENAI', 'ANTHROPIC', 'XAI', 'GOOGLE', 'META', 'MISTRAL'])
      expect(providers).toContain(`case '${provider}'`)
    expect(runner).toContain('providers.map(async (provider)')
  })

  it('serializes checks per prompt and recovers abandoned runs', () => {
    expect(runner).toContain('pg_try_advisory_xact_lock')
    expect(runner).toContain("status: 'RUNNING'")
    expect(runner).toContain('Visibility check timed out before completion')
  })

  it('records usage under a reservation and logs both success and failure', () => {
    expect(runner).toContain('consumeClientTokens(')
    expect(runner).toContain("'AI_VISIBILITY_CHECKED'")
    expect(runner).toContain("logger.info('ai visibility prompt completed'")
    expect(runner).toContain("logger.error('ai visibility provider failed'")
  })

  it('stores aggregated crawler observations without retaining IP addresses', () => {
    expect(crawlerPlugin).toContain('aiCrawlerDaily.upsert')
    expect(crawlerPlugin).toContain('cachedTenantByHost(event)')
    expect(crawlerPlugin).not.toContain('getRequestIP')
  })

  it('keeps AI referrals separate from crawler and citation evidence', () => {
    expect(referralEndpoint).toContain('aiReferralVisit.upsert')
    expect(referralEndpoint).toContain('aiReferrer(')
    expect(referralEndpoint).not.toContain('aiCitation')
  })
})
