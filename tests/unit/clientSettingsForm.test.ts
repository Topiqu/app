import equal from 'fast-deep-equal'
import { describe, expect, it } from 'vitest'

import type { ClientSite } from '../../app/utils/buildClientSettingsForm'

import { buildClientSettingsForm, buildClientSettingsPatch } from '../../app/utils/buildClientSettingsForm'

const baseClient = (overrides: Partial<ClientSite> = {}): ClientSite =>
  ({
    focus: 'tech',
    audience: 'devs',
    language: 'cs',
    theme: 'green',
    keywords: ['a', 'b'],
    description: 'desc',
    tagline: 'Independent analysis',
    logoUrl: 'https://cdn/logo.png',
    faviconUrl: 'https://cdn/favicon.png',
    typographyPreset: 'EDITORIAL',
    socials: [{ platform: 'X', url: 'https://x.com/acme' }],
    apiKey: 'sk_test',
    aiUser: { username: 'bot', bio: 'bio', avatarUrl: 'https://cdn/av.png' },
    aiToneOfVoice: 'friendly',
    aiControversyLevel: 'low',
    gtagId: 'G-123',
    gamNetworkCode: '456',
    autoRelease: true,
    aiSeriesEnabled: true,
    translationMode: 'AUTO',
    translationLanguages: ['en'],
    allowGtag: true,
    ...overrides,
  }) as unknown as ClientSite

describe('buildClientSettingsForm', () => {
  it('preserves disabled community and publication settings through reload and reset', () => {
    const disabled = {
      commentsEnabled: false,
      commentGifsEnabled: false,
      publishToWeb: false,
      publishToShopify: false,
      publishToLinkedIn: false,
    }
    expect(buildClientSettingsForm(baseClient(disabled))).toMatchObject(disabled)
    expect(buildClientSettingsForm(null)).toMatchObject({
      commentsEnabled: true,
      commentGifsEnabled: true,
      publishToWeb: true,
      publishToShopify: true,
      publishToLinkedIn: true,
    })
  })
  it('returns the default shape for a null/undefined client', () => {
    const form = buildClientSettingsForm(null)
    expect(form.language).toBe('en')
    expect(form.theme).toBe('blue')
    expect(form.translationMode).toBe('OFF')
    expect(form.aiSeriesEnabled).toBe(false)
    expect(form.linkedinMode).toBe('HitL')
    expect(form.linkedinCompanyType).toBe('pages')
    expect(form.keywords).toEqual([])
    expect(form.socials).toEqual([])
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
      tagline: 'Independent analysis',
      logoUrl: 'https://cdn/logo.png',
      faviconUrl: 'https://cdn/favicon.png',
      typographyPreset: 'EDITORIAL',
      apiKey: 'sk_test',
      aiToneOfVoice: 'friendly',
      aiControversyLevel: 'low',
      gtagId: 'G-123',
      gamNetworkCode: '456',
      autoRelease: true,
      aiSeriesEnabled: true,
      translationMode: 'AUTO',
      translationLanguages: ['en'],
      allowGtag: true,
    })
    expect(form.aiUser).toEqual({
      username: 'bot',
      bio: 'bio',
      avatarUrl: 'https://cdn/av.png',
      optimizedAvatarUrl: '',
    })
    expect(form.optimizedUrl).toBe('')
  })

  it('derives linkedin fields from linkedinCompanies[0]', () => {
    const client = baseClient({
      linkedinCompanies: [{ mode: 'FullAuto', type: 'personal' }],
    } as Partial<ClientSite>)
    const form = buildClientSettingsForm(client)
    expect(form.linkedinMode).toBe('FullAuto')
    expect(form.linkedinCompanyType).toBe('personal')
  })

  it('falls back to the legacy linkedinCompany object when no array is present', () => {
    const client = baseClient({
      linkedinCompany: { mode: 'FullAuto', type: 'pages' },
    } as Partial<ClientSite>)
    const form = buildClientSettingsForm(client)
    expect(form.linkedinMode).toBe('FullAuto')
    expect(form.linkedinCompanyType).toBe('pages')
  })

  it('is deterministic — two calls with the same client are deep-equal (initial isDirty === false)', () => {
    const client = baseClient()
    expect(equal(buildClientSettingsForm(client), buildClientSettingsForm(client))).toBe(true)
  })
})

describe('buildClientSettingsPatch', () => {
  it('sends only community changes without unrelated integration fields', () => {
    const pristine = buildClientSettingsForm(baseClient())
    const form = { ...pristine, commentsEnabled: false, commentGifsEnabled: false }
    expect(buildClientSettingsPatch(form, pristine)).toEqual({ commentsEnabled: false, commentGifsEnabled: false })
  })

  it('preserves false channel values and filters empty social URLs only when socials change', () => {
    const pristine = buildClientSettingsForm(baseClient())
    const form = { ...pristine, publishToWeb: false, socials: [{ platform: 'X' as const, url: ' ' }] }
    expect(buildClientSettingsPatch(form, pristine)).toEqual({ publishToWeb: false, socials: [] })
    expect(buildClientSettingsPatch(pristine, pristine)).toEqual({})
  })
})
