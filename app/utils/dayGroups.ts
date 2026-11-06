export const dayKey = (date: Date, timeZone?: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)

/**
 * Groups newest-first items into consecutive days. `relativeTo` adds "today" and "yesterday"; leave it
 * out, with a fixed `timeZone`, while hydrating so the server and the browser render the same groups.
 */
export const groupByDay = <T extends { createdAt: string | Date }>(
  items: readonly T[],
  { locale, timeZone, relativeTo }: { locale: string; timeZone?: string; relativeTo?: Date },
) => {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const today = relativeTo && dayKey(relativeTo, timeZone)
  const yesterday = relativeTo && dayKey(new Date(relativeTo.getTime() - 86_400_000), timeZone)
  const year = (relativeTo ?? new Date()).getUTCFullYear()

  const groups: Array<{ key: string; label: string; items: T[] }> = []
  for (const item of items) {
    const date = new Date(item.createdAt)
    const key = dayKey(date, timeZone)
    let group = groups.at(-1)
    if (group?.key !== key) {
      const label =
        key === today
          ? capitalize(relative.format(0, 'day'), locale)
          : key === yesterday
            ? capitalize(relative.format(-1, 'day'), locale)
            : new Intl.DateTimeFormat(locale, {
                timeZone,
                day: 'numeric',
                month: 'long',
                ...(key.startsWith(String(year)) ? {} : { year: 'numeric' as const }),
              }).format(date)
      group = { key, label, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}
