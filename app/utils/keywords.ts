// Merges a raw entry — one keyword or a pasted comma list — into an existing list, case-insensitively
// deduped. Returns `current` itself when nothing survives, so callers can skip a no-op emit.
export const addKeywords = (current: string[], raw: string): string[] => {
  const next = [...current]

  for (const keyword of raw.split(',').map((k) => k.trim())) {
    if (keyword && !next.some((k) => k.toLowerCase() === keyword.toLowerCase())) next.push(keyword)
  }

  return next.length === current.length ? current : next
}
