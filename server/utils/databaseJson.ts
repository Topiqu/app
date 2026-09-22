import type { JsonValue } from '@zenstackhq/orm'

/** Normalizes SDK objects by removing properties whose value is `undefined`. */
export const toDatabaseJson = (value: unknown): JsonValue => {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError('Value cannot be stored as JSON')
  return JSON.parse(serialized) as JsonValue
}
