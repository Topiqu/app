import equal from 'fast-deep-equal'
import { describe, expect, it } from 'vitest'

import type { ClientSite } from '../../app/utils/buildClientSettingsForm'

import { buildClientSettingsForm } from '../../app/utils/buildClientSettingsForm'

const baseClient = (overrides: Partial<ClientSite> = {}): ClientSite =>
  ({
    focus: 'tech',
    audience: 'devs',
    language: 'cs',
    theme: 'green',
    keywords: ['a', 'b'],
    description: 'desc',
    logoUrl: 'https://cdn/logo.png',
    socials: [{ platform: 'X', url: 'https://x.com/acme' }],
    apiKey: 'sk_test',
    aiUser: { username: 'bot', bio: 'bio', avatarUrl: 'https://cdn/av.png' },
    aiToneOfVoice: 'friendly',
    aiControversyLevel: 'low',
    gtagId: 'G-123',
    gamNetworkCode: '456',
    autoRelease: true,
    translationMode: 'AUTO',
    translationLanguages: ['en'],
    allowAds: true,
    allowGtag: true,
    ...overrides,
  }) as unknown as ClientSite

describe('buildClientSettingsForm', () => {
  it('returns the default shape for a null/undefined client', () => {
    const form = buildClientSettingsForm(null)
    expect(form.language).toBe('en')
    expect(form.theme).toBe('blue')
    expect(form.translationMode).toBe('OFF')
    expect(form.linkedinMode).toBe('HitL')
    expect(form.linkedinCompanyType).toBe('pages')
    expect(form.keywords).toEqual([])
    expect(form.socials).toEqual([])
    expect(form.allowAds).toBe(false)
    expect(form.apiKey).toBe('')
    expect(form.aiUser).toEqual({ username: '', bio: '', avatarUrl: '', optimizedAvatarUrl: '' })
    expect(buildClientSettingsForm(undefined)).toEqual(form)
  })

  it('maps all scalar fields from the client', () => {
    const form = buildClientSettingsForm(baseClient())
    expect(form).toMatchObject({
      focus: 'tech',
      audience: 'devs',
      language: 'cs',
      theme: 'green',
      keywords: ['a', 'b'],
      description: 'desc',
      logoUrl: 'https://cdn/logo.png',
      apiKey: 'sk_test',
      aiToneOfVoice: 'friendly',
      aiControversyLevel: 'low',
      gtagId: 'G-123',
      gamNetworkCode: '456',
      autoRelease: true,
      translationMode: 'AUTO',
      translationLanguages: ['en'],
      allowAds: true,
      allowGtag: true,
    })
    expect(form.aiUser).toEqual({ username: 'bot', bio: 'bio', avatarUrl: 'https://cdn/av.png', optimizedAvatarUrl: '' })
    expect(form.optimizedUrl).toBe('')
  })

  it('derives linkedin fields from linkedinCompanies[0]', () => {
    const profile = { tone: 'bold', audience: 'B2B', doList: ['x'], dontList: ['y'] }
    const client = baseClient({
      linkedinCompanies: [{ mode: 'FullAuto', type: 'personal', brandProfile: profile }],
    } as Partial<ClientSite>)
    const form = buildClientSettingsForm(client)
    expect(form.linkedinMode).toBe('FullAuto')
    expect(form.linkedinCompanyType).toBe('personal')
    expect(form.linkedinBrandProfile).toEqual(profile)
  })

  it('falls back to the legacy linkedinCompany object when no array is present', () => {
    const client = baseClient({
      linkedinCompany: { mode: 'FullAuto', type: 'pages', brandProfile: { tone: 't', audience: 'a', doList: [], dontList: [] } },
    } as Partial<ClientSite>)
    const form = buildClientSettingsForm(client)
    expect(form.linkedinMode).toBe('FullAuto')
    expect(form.linkedinBrandProfile.tone).toBe('t')
  })

  it('is deterministic — two calls with the same client are deep-equal (initial isDirty === false)', () => {
    const client = baseClient()
    expect(equal(buildClientSettingsForm(client), buildClientSettingsForm(client))).toBe(true)
  })
})
