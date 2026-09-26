import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { suggestBrandColors } from '../../server/utils/brandPalette'
import { resolveBrandAccent, tenantFontFaceCss, tenantThemeStyle } from '../../app/composables/theme'
import {
  contrastRatio,
  hasAdvancedBranding,
  hostedFontUrl,
  normalizeAccentColor,
  parseBrandGradient,
} from '../../shared/utils/publicationBranding'

describe('custom publication colors', () => {
  it('normalizes only six-digit opaque HEX colors', () => {
    expect(normalizeAccentColor('#c73a8f')).toBe('#C73A8F')
    expect(normalizeAccentColor('#fff')).toBeNull()
    expect(normalizeAccentColor('#123456; color: red')).toBeNull()
    expect(normalizeAccentColor(null)).toBeNull()
  })

  it('accepts two or three safe gradient stops with an integer angle', () => {
    expect(parseBrandGradient({ colors: ['#ff0000', '#0099aa'], angle: 135 })).toEqual({
      colors: ['#FF0000', '#0099AA'],
      angle: 135,
    })
    expect(parseBrandGradient({ colors: ['#111111', '#222222', '#333333'], angle: 360 })).not.toBeNull()
    expect(parseBrandGradient({ colors: ['#ff0000'], angle: 90 })).toBeNull()
    expect(parseBrandGradient({ colors: ['#ff0000', '#00ff00'], angle: 1.5 })).toBeNull()
    expect(parseBrandGradient({ colors: ['red', '#00ff00'], angle: 90 })).toBeNull()
    expect(parseBrandGradient({ colors: ['#ff0000', '#00ff00'], angle: 90, extra: 'css' })).toBeNull()
  })

  it('keeps custom CTA text legible in light and dark mode', () => {
    for (const color of ['#FFFF00', '#111111', '#FF8A00', '#6A30D2']) {
      const style = tenantThemeStyle('blue', 'MODERN', { accentColor: color })
      expect(contrastRatio(style['--topiqu-cta-bg'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(style['--topiqu-cta-hover'], '#ffffff')).toBeGreaterThanOrEqual(5.5)
      expect(contrastRatio(style['--topiqu-cta-dark-bg'], '#0f172a')).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(style['--topiqu-cta-dark-hover'], '#0f172a')).toBeGreaterThanOrEqual(5.5)
    }
    expect(resolveBrandAccent('blue', '#c73a8f')).toBe('#C73A8F')
  })

  it('uses premium gradients and custom fonts only for eligible plans', () => {
    const options = {
      accentColor: '#A243FA',
      brandGradient: { colors: ['#a243fa', '#123456'], angle: 120 },
      headingFontUrl: 'https://cdn.example.com/fonts/tenant-1/12345678-1234-1234-1234-123456789abc.woff2',
      bodyFontUrl: 'https://cdn.example.com/fonts/tenant-1/12345678-1234-1234-1234-123456789abd.woff2',
    }
    expect(hasAdvancedBranding('BASIC')).toBe(false)
    expect(hasAdvancedBranding('PRO')).toBe(true)
    expect(hasAdvancedBranding('PREMIUM')).toBe(true)
    expect(hasAdvancedBranding('CUSTOM')).toBe(true)
    expect(tenantThemeStyle('blue', 'CUSTOM', { ...options, plan: 'BASIC' })['--topiqu-brand-gradient']).toBe('none')
    expect(
      tenantThemeStyle('blue', 'CUSTOM', { ...options, plan: 'BASIC' })['--topiqu-publication-font'],
    ).not.toContain('Topiqu Custom')
    expect(tenantThemeStyle('blue', 'CUSTOM', { ...options, plan: 'PRO' })['--topiqu-brand-gradient']).toBe(
      'linear-gradient(120deg, #A243FA, #123456)',
    )
    expect(tenantThemeStyle('blue', 'CUSTOM', { ...options, plan: 'PRO' })['--topiqu-heading-font']).toContain(
      'Topiqu Custom Heading',
    )
  })
})

describe('hosted publication fonts', () => {
  const cdn = 'https://cdn.example.com'
  const tenant = 'tenant-1'
  const path = '/fonts/tenant-1/12345678-1234-1234-1234-123456789abc.woff2'

  it('only renders immutable WOFF2 paths owned by the tenant', () => {
    const url = cdn + path
    expect(hostedFontUrl(url, cdn, tenant)).toBe(url)
    expect(hostedFontUrl(url, cdn, 'tenant-2')).toBeNull()
    expect(hostedFontUrl(`https://other.example.com${path}`, cdn, tenant)).toBeNull()
    expect(hostedFontUrl(`${url}?x=";color:red`, cdn, tenant)).toBeNull()
    expect(hostedFontUrl(`${url}#fragment`, cdn, tenant)).toBeNull()
    expect(hostedFontUrl(`${cdn}/fonts/tenant-1/not-a-uuid.woff2`, cdn, tenant)).toBeNull()
    expect(tenantFontFaceCss(tenant, cdn, 'CUSTOM', { plan: 'BASIC', headingFontUrl: url })).toBe('')
    expect(tenantFontFaceCss(tenant, cdn, 'CUSTOM', { plan: 'PRO', headingFontUrl: url })).toContain(url)
    expect(tenantFontFaceCss(tenant, cdn, 'MODERN', { plan: 'PRO', headingFontUrl: url })).toBe('')
  })
})

describe('logo color suggestions', () => {
  it('extracts distinct saturated colors and ignores neutral pixels', async () => {
    const pixels = Buffer.alloc(80 * 40 * 4)
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 80; x++) {
        const offset = (y * 80 + x) * 4
        const color = x < 30 ? [204, 34, 68] : x < 60 ? [17, 126, 128] : [140, 140, 140]
        pixels.set([...color, 255], offset)
      }
    }
    const image = await sharp(pixels, { raw: { width: 80, height: 40, channels: 4 } })
      .png()
      .toBuffer()
    const colors = await suggestBrandColors(image)
    expect(colors).toContain('#CC2244')
    expect(colors).toContain('#117E80')
    expect(colors).toHaveLength(2)
  })

  it('does not suggest a color from a transparent logo', async () => {
    const image = await sharp({
      create: { width: 12, height: 12, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()
    expect(await suggestBrandColors(image)).toEqual([])
  })
})
