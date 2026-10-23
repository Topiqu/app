export async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Concurrency must be a positive integer')
  const results: R[] = []
  for (let index = 0; index < items.length; index += limit)
    results.push(...(await Promise.all(items.slice(index, index + limit).map(run))))
  return results
}
