import equal from 'fast-deep-equal'

/** Callers supply an explicit list of persisted fields, never the raw request body. */
export const auditChanges = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
) => {
  const changes: Record<string, { before: unknown; after: unknown }> = {}
  for (const field of new Set(fields)) {
    const previous = toDatabaseJson(before[field] ?? null)
    const next = toDatabaseJson(after[field] ?? null)
    if (!equal(previous, next)) changes[field] = { before: previous, after: next }
  }
  return changes
}
