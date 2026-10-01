export const IMAGE_WIDTHS = [25, 50, 75, 100] as const

export const FIGURE_ALIGNS = ['left', 'center', 'right', 'float-left', 'float-right'] as const

export type FigureAlign = (typeof FIGURE_ALIGNS)[number]

/** Percent of the column in 5 % steps; `null` is full width, which is stored as no width at all. */
export const snapImageWidth = (percent: number) => {
  if (!Number.isFinite(percent)) return null
  const snapped = Math.min(100, Math.max(10, Math.round(percent / 5) * 5))
  return snapped === 100 ? null : snapped
}

// DOMPurify keeps any `style`, so only a bare percentage is read back.
export const parseImageWidth = (css?: string | null) => {
  const match = css?.trim().match(/^(\d+(?:\.\d+)?)%$/)
  return match ? snapImageWidth(Number(match[1])) : null
}

export const parseFigureAlign = (value?: string | null): FigureAlign =>
  FIGURE_ALIGNS.includes(value as FigureAlign) ? (value as FigureAlign) : 'center'

/** An author types `example.com`; anything with a scheme other than http(s)/mailto is refused. */
export const normalizeImageHref = (value?: string | null) => {
  const href = value?.trim()
  if (!href) return null
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('/') ? href : `https://${href}`
  return /^(?:https?:\/\/|mailto:|\/(?!\/))/i.test(withScheme) ? withScheme : null
}
