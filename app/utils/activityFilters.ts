export type SortableEntry = { createdAt: string | null; likesCount: number; views?: number }

export function matchesFilters(text: string, tags: string[], query: string, selectedTags: string[]) {
  const matchesQuery = text.toLowerCase().includes(query.toLowerCase())
  return matchesQuery && selectedTags.every((tag) => tags.includes(tag))
}

// `sort` arrives as the FormSelect value, e.g. `likes:desc`. An unknown field falls back to views,
// which is what the API does with it too.
export function compareBySort<T extends SortableEntry>(sort: string) {
  const [field, order] = sort.split(':')
  const read = (entry: T) =>
    field === 'createdAt'
      ? new Date(entry.createdAt || 0).getTime()
      : field === 'likes'
        ? entry.likesCount || 0
        : entry.views || 0

  return (a: T, b: T) => (order === 'asc' ? read(a) - read(b) : read(b) - read(a))
}
