import { describe, expect, it } from 'vitest'
import {
  buildSetupChecklist,
  buildSetupSteps,
  setupProgress,
  type SiteSetupChecklistInfo,
} from '~~/shared/utils/siteSetup'

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

describe('full blog setup checklist', () => {
  const configured = (): SiteSetupChecklistInfo => ({
    name: 'Our blog',
    logoUrl: '/logo.webp',
    description: 'Advice for our readers',
    plan: 'PRO',
    domain: 'our-blog.topiqu.com',
    domainVerified: true,
    pendingDomain: null,
    focus: 'Web design',
    audience: 'Business owners',
    aiToneOfVoice: 'Clear and practical',
    aiUser: { username: 'Editorial team', bio: 'Our writers', avatarUrl: '/author.webp' },
    setup: {
      hasPublishedArticle: true,
      knowledge: { indexed: 1, processing: 0, failed: 0 },
      publishing: { automatic: false, scheduled: true, scheduleValid: true },
      measurement: { analytics: true, searchConsole: false },
      team: { members: 2, invitations: 0 },
      channels: { shopify: false, linkedin: true },
    },
  })

  it('checks branding, author, content, knowledge and publication from saved data', () => {
    const steps = buildSetupChecklist(configured())
    expect(steps.map((step) => step.id)).toEqual([
      'website',
      'draft',
      'article',
      'branding',
      'author',
      'voice',
      'knowledge',
      'publishing',
      'measurement',
      'team',
      'channels',
    ])
    expect(steps.filter((step) => step.phase === 'start').map((step) => step.id)).toEqual([
      'website',
      'draft',
      'article',
    ])
    expect(setupProgress(steps)).toEqual({ done: 11, total: 11, percent: 100 })
  })

  it('requires a logo and description for full branding without blocking first publication', () => {
    const site = { ...configured(), logoUrl: null }
    const branding = buildSetupChecklist(site).find((step) => step.id === 'branding')
    expect(branding).toMatchObject({ phase: 'later', done: false })
    expect(branding!.requirements).toContainEqual({ id: 'logo', done: false })
    expect(buildSetupSteps(site)[0]!.done).toBe(true)
  })

  it('does not treat an automatically created author name as a finished profile', () => {
    const site = {
      ...configured(),
      aiUser: { username: 'Editorial team', bio: ' ', avatarUrl: null },
      aiToneOfVoice: '',
    }
    expect(buildSetupChecklist(site).find((step) => step.id === 'author')).toMatchObject({
      done: false,
      requirements: [
        { id: 'authorName', done: true },
        { id: 'avatar', done: false },
        { id: 'bio', done: false },
        { id: 'tone', done: false },
      ],
    })
  })

  it('does not count processing or failed knowledge sources as usable AI context', () => {
    const knowledgeStep = (knowledge: { indexed: number; processing: number; failed: number }) =>
      buildSetupChecklist({ ...configured(), setup: { hasPublishedArticle: true, knowledge } }).find(
        (step) => step.id === 'knowledge',
      )
    expect(knowledgeStep({ indexed: 0, processing: 1, failed: 0 })).toMatchObject({ done: false, state: 'processing' })
    expect(knowledgeStep({ indexed: 0, processing: 0, failed: 1 })).toMatchObject({ done: false, state: 'attention' })
    expect(knowledgeStep({ indexed: 1, processing: 1, failed: 1 })).toMatchObject({ done: true, state: 'done' })
  })

  it('does not ask a Basic customer to configure AI features', () => {
    const steps = buildSetupChecklist({ ...configured(), plan: 'BASIC', domain: 'blog.example.com' })
    expect(steps.map((step) => [step.id, step.phase])).toEqual([
      ['branding', 'start'],
      ['article', 'start'],
      ['domain', 'later'],
      ['team', 'later'],
    ])
  })

  describe('first article phase', () => {
    const fresh = (website?: SiteSetupChecklistInfo['websiteImport']): SiteSetupChecklistInfo => ({
      ...configured(),
      focus: null,
      audience: null,
      websiteImport: website,
      setup: { hasPublishedArticle: false, knowledge: { indexed: 0, processing: 0, failed: 0 } },
    })
    const website = (site: SiteSetupChecklistInfo) => buildSetupChecklist(site).find((step) => step.id === 'website')

    it.each([
      ['PENDING', 'processing'],
      ['PROCESSING', 'processing'],
      ['READY', 'todo'],
      ['FAILED', 'attention'],
    ] as const)('follows a %s import until it is reviewed', (status, state) => {
      expect(website(fresh({ status }))).toMatchObject({ done: false, state })
    })

    it('finishes after a review, even a skipped one, or with a brief entered by hand', () => {
      expect(website(fresh({ status: 'REVIEWED' }))?.done).toBe(true)
      expect(website(fresh(null))).toMatchObject({ done: false, state: 'todo' })
      expect(website({ ...fresh({ status: 'FAILED' }), focus: 'Coffee', audience: 'Home baristas' })).toMatchObject({
        done: true,
        state: 'done',
      })
      expect(website({ ...fresh(null), focus: 'Coffee', audience: ' ' })?.done).toBe(false)
    })

    it('counts a finished generation or a publication as the first draft', () => {
      const draft = (setup: Partial<NonNullable<SiteSetupChecklistInfo['setup']>>) =>
        buildSetupChecklist({ ...fresh(null), setup: { ...fresh(null).setup!, ...setup } }).find(
          (step) => step.id === 'draft',
        )?.done
      expect(draft({})).toBe(false)
      expect(draft({ hasDraft: true })).toBe(true)
      expect(draft({ hasPublishedArticle: true })).toBe(true)
    })

    it('keeps the first steps first so the next open step is always the one that leads to an article', () => {
      const steps = buildSetupChecklist(fresh({ status: 'READY' }))
      expect(steps.find((step) => !step.done && !step.skipped)?.id).toBe('website')
      expect(setupProgress(steps.filter((step) => step.phase === 'start'))).toEqual({ done: 0, total: 3, percent: 0 })
    })
  })

  it('keeps a verified custom domain in the checklist as a completed step', () => {
    const steps = buildSetupChecklist({ ...configured(), domain: 'blog.example.com' })
    expect(steps.find((step) => step.id === 'domain')).toMatchObject({ done: true })
    expect(setupProgress(steps)).toEqual({ done: 12, total: 12, percent: 100 })
  })

  it('does not confuse a verified active domain with a pending replacement', () => {
    expect(
      buildSetupChecklist({ ...configured(), pendingDomain: 'new.example.com' }).find((step) => step.id === 'domain'),
    ).toMatchObject({ done: false })
  })

  it('does not count a draft as a publication and handles unknown status without fake progress', () => {
    expect(
      buildSetupChecklist({
        ...configured(),
        setup: {
          hasPublishedArticle: false,
          draftArticleSlug: 'draft',
          knowledge: { indexed: 1, processing: 0, failed: 0 },
        },
      }).find((step) => step.id === 'article')!.done,
    ).toBe(false)
    expect(buildSetupChecklist(null)).toEqual([])
    expect(setupProgress(buildSetupChecklist(null))).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('accepts an explicitly reviewed manual mode without enabling automation', () => {
    const site = {
      ...configured(),
      setup: { ...configured().setup!, publishing: { automatic: false, scheduled: false, scheduleValid: true } },
    }
    expect(buildSetupChecklist(site).find((step) => step.id === 'publishing')?.done).toBe(false)
    expect(
      buildSetupChecklist(site, undefined, { publishingReviewed: true, skipped: [] }).find(
        (step) => step.id === 'publishing',
      )?.done,
    ).toBe(true)
    expect(site.setup.publishing.automatic).toBe(false)
  })

  it('does not accept an invalid active schedule even after review', () => {
    const site = {
      ...configured(),
      setup: { ...configured().setup!, publishing: { automatic: true, scheduled: true, scheduleValid: false } },
    }
    expect(
      buildSetupChecklist(site, undefined, { publishingReviewed: true, skipped: [] }).find(
        (step) => step.id === 'publishing',
      )?.done,
    ).toBe(false)
  })

  it('resolves optional steps by skipping without claiming their requirements are complete', () => {
    const site = {
      ...configured(),
      setup: {
        ...configured().setup!,
        measurement: { analytics: false, searchConsole: false },
        team: { members: 1, invitations: 0 },
        channels: { shopify: false, linkedin: false },
      },
    }
    const steps = buildSetupChecklist(site, undefined, {
      publishingReviewed: false,
      skipped: ['measurement', 'team', 'channels'],
    })
    expect(setupProgress(steps)).toEqual({ done: 11, total: 11, percent: 100 })
    expect(steps.find((step) => step.id === 'team')).toMatchObject({
      optional: true,
      skipped: true,
      done: false,
      requirements: [{ id: 'teammate', done: false }],
    })
    expect(
      buildSetupChecklist(configured(), undefined, { publishingReviewed: false, skipped: ['team'] }).find(
        (step) => step.id === 'team',
      ),
    ).toMatchObject({ done: true, skipped: false })
  })

  it('counts a valid invitation before acceptance but not the owner alone', () => {
    for (const [team, expected] of [
      [{ members: 1, invitations: 0 }, false],
      [{ members: 1, invitations: 1 }, true],
      [{ members: 2, invitations: 0 }, true],
    ] as const) {
      expect(
        buildSetupChecklist({ ...configured(), setup: { ...configured().setup!, team } }).find(
          (step) => step.id === 'team',
        )?.done,
      ).toBe(expected)
    }
  })
})
