import {
  accessibleAccent,
  gradientCss,
  hasAdvancedBranding,
  hostedFontUrl,
  normalizeAccentColor,
  parseBrandGradient,
} from '~~/shared/utils/publicationBranding'

export const themeColors = {
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  purple: '#7c3aed',
  orange: '#f97316',
  teal: '#0d9488',
  yellow: '#eab308',
  pink: '#ec4899',
  indigo: '#4f46e5',
  gray: '#6b7280',
  lime: '#65a30d',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
} as const

export type ThemeKey = keyof typeof themeColors
export type PublicationTypography = 'MODERN' | 'EDITORIAL' | 'SYSTEM' | 'MAGAZINE' | 'CUSTOM'
export const DEFAULT_TENANT_THEME: ThemeKey = 'indigo'

// Explicit values keep the public CTA independent from Tailwind's generated palette.
// Every foreground/background pair is at least WCAG AA for normal text.
export const tenantCtaPalette = {
  blue: { light: ['#1d4ed8', '#1e40af'], dark: ['#93c5fd', '#bfdbfe'] },
  green: { light: ['#15803d', '#166534'], dark: ['#86efac', '#bbf7d0'] },
  red: { light: ['#b91c1c', '#991b1b'], dark: ['#fca5a5', '#fecaca'] },
  purple: { light: ['#6d28d9', '#5b21b6'], dark: ['#d8b4fe', '#e9d5ff'] },
  orange: { light: ['#c2410c', '#9a3412'], dark: ['#fdba74', '#fed7aa'] },
  teal: { light: ['#0f766e', '#115e59'], dark: ['#5eead4', '#99f6e4'] },
  yellow: { light: ['#854d0e', '#713f12'], dark: ['#fde047', '#fef08a'] },
  pink: { light: ['#be185d', '#9d174d'], dark: ['#f9a8d4', '#fbcfe8'] },
  indigo: { light: ['#4338ca', '#3730a3'], dark: ['#a5b4fc', '#c7d2fe'] },
  gray: { light: ['#4b5563', '#374151'], dark: ['#cbd5e1', '#e2e8f0'] },
  lime: { light: ['#4d7c0f', '#3f6212'], dark: ['#bef264', '#d9f99d'] },
  sky: { light: ['#0369a1', '#075985'], dark: ['#7dd3fc', '#bae6fd'] },
  amber: { light: ['#92400e', '#78350f'], dark: ['#fcd34d', '#fde68a'] },
  cyan: { light: ['#0e7490', '#155e75'], dark: ['#67e8f9', '#a5f3fc'] },
  violet: { light: ['#6d28d9', '#5b21b6'], dark: ['#c4b5fd', '#ddd6fe'] },
} as const satisfies Record<ThemeKey, { light: readonly [string, string]; dark: readonly [string, string] }>

export const resolveTenantTheme = (value: unknown): ThemeKey => {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return Object.prototype.hasOwnProperty.call(themeColors, key) ? (key as ThemeKey) : DEFAULT_TENANT_THEME
}

export const resolveTypographyPreset = (value: unknown): PublicationTypography =>
  value === 'EDITORIAL' || value === 'SYSTEM' || value === 'MAGAZINE' || value === 'CUSTOM' ? value : 'MODERN'

export const typographyFonts = (value: unknown, headingFontUrl?: string | null, bodyFontUrl?: string | null) => {
  const preset = resolveTypographyPreset(value)
  const modern = '"Manrope Variable", ui-sans-serif, system-ui, sans-serif'
  const editorial = '"Source Serif 4 Variable", Georgia, serif'
  const system = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  if (preset === 'EDITORIAL') return { heading: editorial, body: editorial }
  if (preset === 'SYSTEM') return { heading: system, body: system }
  if (preset === 'MAGAZINE') return { heading: editorial, body: modern }
  if (preset === 'CUSTOM')
    return {
      heading: headingFontUrl ? '"Topiqu Custom Heading", ' + modern : modern,
      body: bodyFontUrl ? '"Topiqu Custom Body", ' + modern : modern,
    }
  return { heading: modern, body: modern }
}

export const typographyFontFamily = (value: unknown) => typographyFonts(value).body

export const resolveBrandAccent = (theme: unknown, customColor?: unknown) =>
  normalizeAccentColor(customColor) ?? themeColors[resolveTenantTheme(theme)]

export type TenantBrandOptions = {
  accentColor?: unknown
  brandGradient?: unknown
  plan?: unknown
  headingFontUrl?: string | null
  bodyFontUrl?: string | null
}

export const tenantThemeStyle = (value: unknown, typography?: unknown, options: TenantBrandOptions = {}) => {
  const key = resolveTenantTheme(value)
  const customColor = normalizeAccentColor(options.accentColor)
  const [background, hover] = customColor
    ? [accessibleAccent(customColor, '#ffffff'), accessibleAccent(customColor, '#ffffff', 5.5)]
    : tenantCtaPalette[key].light
  const [darkBackground, darkHover] = customColor
    ? [accessibleAccent(customColor, '#0f172a'), accessibleAccent(customColor, '#0f172a', 5.5)]
    : tenantCtaPalette[key].dark
  const advanced = hasAdvancedBranding(options.plan)
  const preset = advanced
    ? resolveTypographyPreset(typography)
    : resolveTypographyPreset(typography) === 'CUSTOM'
      ? 'MODERN'
      : typography
  const fonts = typographyFonts(preset, advanced ? options.headingFontUrl : null, advanced ? options.bodyFontUrl : null)
  const gradient = advanced ? parseBrandGradient(options.brandGradient) : null
  return {
    '--topiqu-tenant-accent-light': background,
    '--topiqu-tenant-accent-dark': darkBackground,
    '--topiqu-tenant-accent-foreground': '#ffffff',
    '--topiqu-cta-bg': background,
    '--topiqu-cta-hover': hover,
    '--topiqu-cta-fg': '#ffffff',
    '--topiqu-cta-focus': '#0f172a',
    '--topiqu-cta-dark-bg': darkBackground,
    '--topiqu-cta-dark-hover': darkHover,
    '--topiqu-cta-dark-fg': '#0f172a',
    '--topiqu-cta-dark-focus': '#f8fafc',
    '--topiqu-publication-font': fonts.body,
    '--topiqu-heading-font': fonts.heading,
    '--topiqu-brand-gradient': gradient ? gradientCss(gradient) : 'none',
  }
}

export const tenantFontFaceCss = (
  clientSiteId: string,
  cdnUrl: string,
  typography: unknown,
  options: TenantBrandOptions,
) => {
  if (!hasAdvancedBranding(options.plan) || resolveTypographyPreset(typography) !== 'CUSTOM') return ''
  const headingUrl = hostedFontUrl(options.headingFontUrl, cdnUrl, clientSiteId)
  const bodyUrl = hostedFontUrl(options.bodyFontUrl, cdnUrl, clientSiteId)
  return [
    headingUrl &&
      `@font-face{font-family:"Topiqu Custom Heading";src:url("${headingUrl}") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}`,
    bodyUrl &&
      `@font-face{font-family:"Topiqu Custom Body";src:url("${bodyUrl}") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}`,
  ]
    .filter(Boolean)
    .join('\n')
}
