export const CHART_KINDS = ['bar', 'line'] as const
export type ChartKind = (typeof CHART_KINDS)[number]
export const isChartKind = (value: unknown): value is ChartKind => CHART_KINDS.includes(value as ChartKind)

/** `labels` keep each cell's own text ("1 410 964 Kč", "12 %"); `values[i]` is null for an empty cell. */
export type ChartSeries = { name: string; values: (number | null)[]; labels: string[] }
export type ChartData = { kind: ChartKind; categories: string[]; series: ChartSeries[] }

export const CHART_MAX_SERIES = 4
export const CHART_MAX_CATEGORIES: Record<ChartKind, number> = { bar: 24, line: 60 }

// `\s` covers NBSP, narrow NBSP and thin space, which cs/fr/pl/sk use to group thousands.
const NUMBER_RUN = /\d(?:[\d\s.,'’]*\d)?/g
const LEADING_GROUP = /^[1-9]\d{0,2}$/
const GROUP = /^\d{3}$/
const SPACE_GROUPED = /^([1-9]\d{0,2}(?:[\s'’]\d{3})+)(?:[.,](\d+))?$/
// A dash right before the number, or a lone dash leading the cell ("− 5 %"); not "Leden – 12".
const MINUS = /(?:^|[\s\p{Sc}(])[-−–‒]$|^\s*[-−–‒]\s+$/u
const SIGN = /[+\-−–‒]\s*$/
const UNIT_NOISE = /[\s*~≈.,:;()[\]+\-−–‒]/g
/** Missing-value placeholders read as an empty cell, not as text that disqualifies the column. */
const BLANK = /^(?:[-–—−‒…?×/]*|n\/a|n\.a\.)$/i

const isGrouped = (parts: string[]) => LEADING_GROUP.test(parts[0]!) && parts.slice(1).every((part) => GROUP.test(part))

const readRun = (run: string): number | null => {
  if (/[\s'’]/.test(run)) {
    const grouped = run.match(SPACE_GROUPED)
    return grouped ? Number(`${grouped[1]!.replace(/[\s'’]/g, '')}.${grouped[2] ?? 0}`) : null
  }

  const dot = run.lastIndexOf('.')
  const comma = run.lastIndexOf(',')
  if (dot === -1 && comma === -1) return Number(run)

  if (dot !== -1 && comma !== -1) {
    const [decimal, thousands] = dot > comma ? ['.', ','] : [',', '.']
    const [integer, fraction, ...rest] = run.split(decimal)
    const groups = integer!.split(thousands)
    return rest.length || !isGrouped(groups) ? null : Number(`${groups.join('')}.${fraction}`)
  }

  const parts = run.split(dot === -1 ? ',' : '.')
  // "1,250" and "12.500.000" group thousands; "3,5", "0,125" and "1234,5" carry a decimal.
  if (parts.length > 2 || (LEADING_GROUP.test(parts[0]!) && GROUP.test(parts[1]!)))
    return isGrouped(parts) ? Number(parts.join('')) : null
  return Number(`${parts[0]}.${parts[1]}`)
}

const readNumber = (text: string) => {
  const runs = [...text.matchAll(NUMBER_RUN)]
  if (runs.length !== 1) return null

  const run = runs[0]!
  const before = text.slice(0, run.index)
  const after = text.slice(run.index + run[0].length)
  // "CO2", "Q1": the digit belongs to a word.
  if (/\p{L}$/u.test(before)) return null

  const magnitude = readRun(run[0])
  if (magnitude === null || !Number.isFinite(magnitude)) return null

  const prefix = before.replace(SIGN, '').trim()
  const suffix = after.trim()
  return {
    value: MINUS.test(before) && magnitude ? -magnitude : magnitude,
    prefix: prefix && `${prefix}${/\s$/.test(before.replace(SIGN, '')) ? '\u00a0' : ''}`,
    suffix: suffix && `${/^\s/.test(after) ? '\u00a0' : ''}${suffix}`,
    unit: `${before}${after}`.toLowerCase().replace(UNIT_NOISE, ''),
  }
}

/** A number as people type it in a table cell, or null when the cell is not exactly one number. */
export const parseChartNumber = (text: string): number | null => readNumber(text)?.value ?? null

// Every value shares one unit: a column mixing "1,2 mil. Kč" with "850 tis. Kč" would plot a lie.
const readSeries = (name: string, labels: string[]): ChartSeries | null => {
  const values: (number | null)[] = []
  let unit: string | undefined
  for (const label of labels) {
    if (BLANK.test(label)) {
      values.push(null)
      continue
    }
    const number = readNumber(label)
    if (!number || (unit !== undefined && number.unit !== unit)) return null
    unit = number.unit
    values.push(number.value)
  }
  return unit === undefined ? null : { name, values, labels }
}

/** Collapses markup line breaks and runs of spaces but keeps the NBSPs a number is grouped with. */
const cleanCell = (cell: string) => cell.replace(/[^\S\u00a0\u202f]+/g, ' ').trim()

/**
 * `rows` are the table's cell texts, header row first. The first column labels the categories;
 * every other column whose filled cells are all numbers in one unit becomes a series. Null means
 * the table is not chartable and stays a plain table.
 */
export const readChart = (kind: string | null, rows: string[][]): ChartData | null => {
  if (!isChartKind(kind)) return null

  const [header = [], ...body] = rows.map((row) => row.map(cleanCell))
  // A single-cell row is a spanning note ("Source: …"), not a category.
  const data = body.filter((row) => row.length > 1 && row.some(Boolean))
  if (data.length < 2 || data.length > CHART_MAX_CATEGORIES[kind]) return null

  const columns = Math.max(header.length, ...data.map((row) => row.length))
  const series: ChartSeries[] = []
  for (let column = 1; column < columns; column++) {
    const read = readSeries(
      header[column] ?? '',
      data.map((row) => row[column] ?? ''),
    )
    if (read) series.push(read)
  }
  if (!series.length || series.length > CHART_MAX_SERIES) return null

  return { kind, categories: data.map((row) => row[0]!), series }
}

/** The prefix and suffix every value shares ("€", " %"), for axis ticks; empty when they differ. */
export const readChartUnit = (series: ChartSeries[]) => {
  const units = series.flatMap((item) => item.labels.filter((label) => !BLANK.test(label)).map(readNumber))
  const [first] = units
  const shared =
    first &&
    units.every((unit) => unit?.prefix === first.prefix && unit.suffix === first.suffix) &&
    first.prefix.length <= 5 &&
    first.suffix.length <= 6
  return shared ? { prefix: first.prefix, suffix: first.suffix } : { prefix: '', suffix: '' }
}

const NICE_STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100]
const round = (value: number) => Number(value.toPrecision(12))

/** 3–5 evenly spaced round ticks covering [min, max]; the first and last are the axis bounds. */
export const chartTicks = (min: number, max: number): number[] => {
  if (min === max) [min, max] = min === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, max)]

  const magnitude = 10 ** Math.floor(Math.log10((max - min) / 4))
  for (const multiple of NICE_STEPS) {
    const step = multiple * magnitude
    // The epsilon keeps 0.3 / 0.1 = 2.9999… from adding a tick below the data.
    const first = Math.floor(min / step + 1e-9)
    const last = Math.ceil(max / step - 1e-9)
    if (last - first <= 4) return Array.from({ length: last - first + 1 }, (_, i) => round((first + i) * step))
  }
  return [min, max]
}
