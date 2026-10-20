import { describe, expect, it } from 'vitest'

import { FooterSettingsSchema, parseFooterSettings, resolveFooterSettings } from '../../shared/utils/publicationFooter'

describe('publication footer settings', () => {
  it('keeps existing blogs visible with their original name and no extra links', () => {
    expect(parseFooterSettings(null)).toEqual({ enabled: true, text: '', showSocials: false, links: [] })
  })

  it.each(['PRO', 'PREMIUM', 'CUSTOM'])('allows paid footer settings on %s', (plan) => {
    const settings = {
      enabled: false,
      text: 'Our publication',
      showSocials: true,
      links: [{ label: 'Contact', url: '/contact' }],
    }
    expect(resolveFooterSettings(settings, plan)).toEqual(settings)
  })

  it.each(['BASIC', 'unknown', null])('restores the Basic footer when the effective plan is %s', (plan) => {
    expect(resolveFooterSettings({ enabled: false, text: 'Paid text', links: [] }, plan)).toEqual(
      parseFooterSettings(null),
    )
  })

  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com'])(
    'rejects unsafe footer link %s',
    (url) => {
      expect(FooterSettingsSchema.safeParse({ links: [{ label: 'Link', url }] }).success).toBe(false)
    },
  )

  it('limits links, labels, and text, and refuses unnamed links', () => {
    expect(
      FooterSettingsSchema.safeParse({ links: Array.from({ length: 7 }, () => ({ label: 'Link', url: '/' })) }).success,
    ).toBe(false)
    expect(FooterSettingsSchema.safeParse({ links: [{ label: '', url: '/' }] }).success).toBe(false)
    expect(FooterSettingsSchema.safeParse({ text: 'x'.repeat(301) }).success).toBe(false)
  })
})
