export const CONTROVERSY_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const

export type ControversyLevel = (typeof CONTROVERSY_LEVELS)[number]

/** How most company blogs write; NONE suits only a niche that must not take sides. */
export const DEFAULT_CONTROVERSY_LEVEL: ControversyLevel = 'LOW'

export const isControversyLevel = (value: unknown): value is ControversyLevel =>
  CONTROVERSY_LEVELS.includes(value as ControversyLevel)

/** Unset reads as the default, also the closest match to the generic voice an unset site used to get. Older rows may be lowercase. */
export const controversyLevelOf = (value: unknown): ControversyLevel => {
  const level = typeof value === 'string' ? value.toUpperCase() : value
  return isControversyLevel(level) ? level : DEFAULT_CONTROVERSY_LEVEL
}
