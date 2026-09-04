export interface DevConsolePosition {
  x: number
  y: number
}

export interface RectangleSize {
  height: number
  width: number
}

const finiteCoordinate = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const clampDevConsolePosition = (
  candidate: unknown,
  viewport: RectangleSize,
  panel: RectangleSize,
  fallback: DevConsolePosition = { x: 16, y: 80 },
): DevConsolePosition => {
  const input = candidate && typeof candidate === 'object' ? (candidate as Partial<DevConsolePosition>) : {}
  const x = finiteCoordinate(input.x, fallback.x)
  const y = finiteCoordinate(input.y, fallback.y)
  return {
    x: Math.min(Math.max(8, x), Math.max(8, viewport.width - panel.width - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, viewport.height - panel.height - 8)),
  }
}

export const readDevConsolePosition = (value: unknown, category: string, fallback: DevConsolePosition): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  return (value as Record<string, unknown>)[category] ?? fallback
}
