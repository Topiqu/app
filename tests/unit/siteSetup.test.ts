import { describe, expect, it } from 'vitest'
import { buildSetupSteps, setupProgress } from '~~/shared/utils/siteSetup'

const ids = (site: Parameters<typeof buildSetupSteps>[0]) => buildSetupSteps(site).map((step) => step.id)

describe('site setup steps', () => {
  it('treats branding as done only when both logo and description exist', () => {
    const branding = (site: Parameters<typeof buildSetupSteps>[0]) => buildSetupSteps(site)[0]!.done
    expect(branding({ logoUrl: '/logo.png' })).toBe(false)
    expect(branding({ description: 'A blog' })).toBe(false)
    expect(branding({ logoUrl: '/logo.png', description: 'A blog' })).toBe(true)
  })

  it('leaves the AI voice step out entirely on plans without AI', () => {
    expect(ids({ plan: 'BASIC', focus: 'devops', audience: 'engineers' })).toEqual(['branding'])
  })

  it.each(['PRO', 'PREMIUM', 'CUSTOM'])('asks for tone and audience on %s', (plan) => {
    expect(buildSetupSteps({ plan, focus: 'devops', audience: 'engineers' })).toContainEqual({
      id: 'voice',
      done: true,
    })
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
    expect(setupProgress(buildSetupSteps(site))).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('handles a missing client site without throwing', () => {
    expect(setupProgress(buildSetupSteps(null))).toEqual({ done: 0, total: 1, percent: 0 })
  })
})
