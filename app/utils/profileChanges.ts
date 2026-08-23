import equal from 'fast-deep-equal'

// Not user edits: `sessions` is server-owned (revoking a device takes effect immediately) and
// `handle` is derived from `username`, so a stale copy of it must not read as a pending change.
const DERIVED_KEYS = ['sessions', 'handle']

// A cleared input yields '', but a column that was never set comes back as null. Compared raw,
// typing into an empty bio and deleting it again leaves the form dirty with nothing to save.
const blankToNull = (value: unknown) => (value === '' ? null : value)

function comparable(profile: object | null | undefined) {
  if (!profile) return {}
  return Object.fromEntries(
    Object.entries(profile)
      .filter(([key]) => !DERIVED_KEYS.includes(key))
      .map(([key, value]) => [key, blankToNull(value)]),
  )
}

export function hasProfileChanges(form: object | null | undefined, original: object | null | undefined) {
  return !equal(comparable(form), comparable(original))
}
