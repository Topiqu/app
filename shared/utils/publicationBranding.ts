export type BrandGradient = { colors: string[]; angle: number }

export const normalizeAccentColor = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null

export const hasAdvancedBranding = (plan: unknown) => plan === 'PRO' || plan === 'PREMIUM' || plan === 'CUSTOM'

export const parseBrandGradient = (value: unknown): BrandGradient | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => key !== 'colors' && key !== 'angle')) return null
  if (!Array.isArray(record.colors) || record.colors.length < 2 || record.colors.length > 3) return null
  if (typeof record.angle !== 'number' || !Number.isInteger(record.angle) || record.angle < 0 || record.angle > 360)
    return null
  const colors = record.colors.map(normalizeAccentColor)
  return colors.every(Boolean) ? { colors: colors as string[], angle: record.angle } : null
}

export const contrastRatio = (first: string, second: string) => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  }
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export const mixBrandColor = (color: string, target: string, amount: number) =>
  `#${[1, 3, 5]
    .map((index) => {
      const source = Number.parseInt(color.slice(index, index + 2), 16)
      const destination = Number.parseInt(target.slice(index, index + 2), 16)
      return Math.round(source + (destination - source) * amount)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`

export const accessibleAccent = (color: string, foreground: '#ffffff' | '#0f172a', target = 4.5) => {
  if (contrastRatio(color, foreground) >= target) return color
  const destination = foreground === '#ffffff' ? '#000000' : '#ffffff'
  let low = 0
  let high = 1
  for (let step = 0; step < 18; step++) {
    const midpoint = (low + high) / 2
    if (contrastRatio(mixBrandColor(color, destination, midpoint), foreground) >= target) high = midpoint
    else low = midpoint
  }
  return mixBrandColor(color, destination, high)
}

export const gradientCss = (gradient: BrandGradient) =>
  `linear-gradient(${gradient.angle}deg, ${gradient.colors.join(', ')})`

export const hostedFontUrl = (value: unknown, cdnBase: string, clientSiteId: string) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const cdn = new URL(cdnBase)
    return url.origin === cdn.origin &&
      !url.search &&
      !url.hash &&
      new RegExp(`^/fonts/${clientSiteId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[a-f0-9-]{36}\\.woff2$`, 'i').test(
        url.pathname,
      )
      ? url.href
      : null
  } catch {
    return null
  }
}
