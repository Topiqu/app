import { describe, expect, it } from 'vitest'
import { buildSetupSteps, setupProgress } from '~~/shared/utils/siteSetup'

const ids = (site: Parameters<typeof buildSetupSteps>[0]) => buildSetupSteps(site).map((step) => step.id)

describe('site setup steps', () => {
  it('accepts a description without a logo and rejects blank descriptions', () => {
    const branding = (site: Parameters<typeof buildSetupSteps>[0]) => buildSetupSteps(site)[0]!.done
    expect(branding({ logoUrl: '/logo.png' })).toBe(false)
    expect(branding({ description: 'A blog' })).toBe(true)
    expect(branding({ description: '   ' })).toBe(false)
    expect(branding({ logoUrl: '/logo.png', description: 'A blog' })).toBe(true)
  })

  it('leaves the AI voice step out entirely on plans without AI', () => {
    expect(ids({ plan: 'BASIC', focus: 'devops', audience: 'engineers' })).toEqual(['branding', 'article'])
  })

  it.each(['PRO', 'PREMIUM', 'CUSTOM'])('asks for focus and audience on %s', (plan) => {
    expect(buildSetupSteps({ plan, focus: 'devops', audience: 'engineers' })).toContainEqual({
      id: 'voice',
      done: true,
    })
  })

  it('keeps an incomplete or whitespace-only AI brief unfinished', () => {
    expect(buildSetupSteps({ plan: 'PRO', focus: 'devops', audience: '  ' })).toContainEqual({
      id: 'voice',
      done: false,
    })
    expect(buildSetupSteps({ plan: 'PRO', audience: 'engineers' })).toContainEqual({ id: 'voice', done: false })
  })

  it('finishes the article step only from the server publication status', () => {
    expect(buildSetupSteps({})).toContainEqual({ id: 'article', done: false })
    expect(buildSetupSteps({ hasPublishedArticle: false })).toContainEqual({ id: 'article', done: false })
    expect(buildSetupSteps({ hasPublishedArticle: true })).toContainEqual({ id: 'article', done: true })
  })

  it('asks about the domain only while a custom domain is unverified', () => {
    expect(ids({ domain: 'acme.topiqu.com', domainVerified: false })).not.toContain('domain')
    expect(ids({ domain: 'blog.example.com', domainVerified: true })).not.toContain('domain')
    expect(buildSetupSteps({ domain: 'blog.example.com', domainVerified: false })).toContainEqual({
      id: 'domain',
      done: false,
    })
  })

  it('counts every listed step toward progress', () => {
    const site = { plan: 'PRO', logoUrl: '/logo.png', description: 'A blog', domain: 'blog.example.com' }
    expect(setupProgress(buildSetupSteps(site))).toEqual({ done: 1, total: 4, percent: 25 })
  })

  it('handles a missing client site without throwing', () => {
    expect(setupProgress(buildSetupSteps(null))).toEqual({ done: 0, total: 2, percent: 0 })
  })
})
