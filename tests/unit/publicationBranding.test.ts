import { describe, expect, it } from 'vitest'

import { presentSourceUrl, sourceFaviconUrl } from '../../app/utils/sourcePresentation'
import {
  resolveTenantTheme,
  resolveTypographyPreset,
  tenantCtaPalette,
  tenantThemeStyle,
  themeColors,
  typographyFontFamily,
} from '../../app/composables/theme'

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

describe('publication theme tokens', () => {
  it('gives every theme AA contrast in default and hover states in both modes', () => {
    for (const theme of Object.keys(themeColors) as (keyof typeof themeColors)[]) {
      const palette = tenantCtaPalette[theme]
      for (const background of palette.light) expect(contrast(background, '#ffffff'), theme).toBeGreaterThanOrEqual(4.5)
      for (const background of palette.dark) expect(contrast(background, '#0f172a'), theme).toBeGreaterThanOrEqual(4.5)
      const style = tenantThemeStyle(theme)
      expect(style['--topiqu-cta-bg']).toBe(palette.light[0])
      expect(style['--topiqu-cta-dark-bg']).toBe(palette.dark[0])
    }
  })

  it('uses indigo and Modern for invalid values', () => {
    expect(resolveTenantTheme('made-up')).toBe('indigo')
    expect(tenantThemeStyle('made-up')['--topiqu-cta-bg']).toBe(tenantCtaPalette.indigo.light[0])
    expect(resolveTypographyPreset('made-up')).toBe('MODERN')
  })

  it('uses one family for all publication copy in each preset', () => {
    expect(typographyFontFamily('MODERN')).toContain('Manrope Variable')
    expect(typographyFontFamily('EDITORIAL')).toContain('Source Serif 4 Variable')
    expect(typographyFontFamily('SYSTEM')).toContain('system-ui')
  })
})

describe('source URL presentation', () => {
  it('presents encoded paths and preserves query and fragment details', () => {
    expect(presentSourceUrl('https://www.example.com/reports/%C4%8Desk%C3%BD%20text.pdf?download=1#page=2')).toEqual({
      hostname: 'example.com',
      path: '/reports/český text.pdf?download=1#page=2',
      valid: true,
    })
  })

  it('handles long and invalid values without throwing', () => {
    const long = `https://example.com/${'segment/'.repeat(100)}file.pdf`
    expect(presentSourceUrl(long).path).toContain('file.pdf')
    expect(presentSourceUrl('not a URL')).toEqual({ hostname: 'not a URL', path: '', valid: false })
    expect(sourceFaviconUrl('not a URL')).toBeUndefined()
    expect(sourceFaviconUrl('https://example.com/a')).toContain('domain=example.com')
  })
})
