import { describe, expect, it } from 'vitest'
import { buildEmptySetupSteps, emptySetupProgress, type EmptySetupStepId } from '~~/shared/utils/emptySite'

const stepById = (site: Parameters<typeof buildEmptySetupSteps>[0], id: EmptySetupStepId) =>
  buildEmptySetupSteps(site).find((step) => step.id === id)!

describe('empty site setup steps', () => {
  it('never marks the first article as done — that is the whole point of the empty state', () => {
    const fullySetUp = {
      name: 'acme',
      logoUrl: '/logo.png',
      description: 'A blog',
      focus: 'devops',
      audience: 'engineers',
      plan: 'PRO',
      domain: 'news.example.com',
      domainVerified: true,
    }

    expect(stepById(fullySetUp, 'article').done).toBe(false)
    expect(emptySetupProgress(buildEmptySetupSteps(fullySetUp))).toEqual({ done: 3, total: 4, percent: 75 })
  })

  it('treats branding as done only when both logo and description exist', () => {
    expect(stepById({ logoUrl: '/logo.png' }, 'branding').done).toBe(false)
    expect(stepById({ description: 'A blog' }, 'branding').done).toBe(false)
    expect(stepById({ logoUrl: '/logo.png', description: 'A blog' }, 'branding').done).toBe(true)
  })

  it('locks the AI voice step on plans without AI and keeps it out of the progress total', () => {
    const basic = { plan: 'BASIC', domain: 'acme.topiqu.com', focus: 'devops', audience: 'engineers' }
    const voice = stepById(basic, 'voice')

    expect(voice.locked).toBe(true)
    expect(voice.done).toBe(false)
    expect(emptySetupProgress(buildEmptySetupSteps(basic)).total).toBe(2)
  })

  it('omits domain verification for a managed subdomain', () => {
    expect(buildEmptySetupSteps({ domain: 'acme.topiqu.com', domainVerified: true })).not.toContainEqual(
      expect.objectContaining({ id: 'domain' }),
    )
  })

  it('keeps domain verification for a custom domain', () => {
    expect(stepById({ domain: 'blog.example.com', domainVerified: false }, 'domain')).toMatchObject({
      done: false,
      locked: false,
    })
  })

  it.each(['PRO', 'PREMIUM', 'CUSTOM'])('unlocks the AI voice step on %s', (plan) => {
    expect(stepById({ plan, focus: 'devops', audience: 'engineers' }, 'voice')).toMatchObject({
      locked: false,
      done: true,
    })
  })

  it('handles a missing client site without throwing', () => {
    const steps = buildEmptySetupSteps(null)

    expect(steps.every((step) => !step.done)).toBe(true)
    expect(emptySetupProgress(steps)).toEqual({ done: 0, total: 2, percent: 0 })
  })
})
