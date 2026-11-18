<template>
  <!-- Validated categorical slots (dataviz palette); dark steps are re-selected, not flipped. -->
  <figure
    class="not-prose my-8 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 text-sm shadow-sm [--chart-1:#2a78d6] [--chart-2:#eb6834] [--chart-3:#1baf7a] [--chart-4:#eda100] sm:p-6 dark:[--chart-1:#3987e5] dark:[--chart-2:#d95926] dark:[--chart-3:#199e70] dark:[--chart-4:#c98500]"
    data-article-chart
  >
    <div role="img" :aria-label="label">
      <ul v-if="chart.series.length > 1" class="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-toned">
        <li v-for="(item, index) in chart.series" :key="index" class="flex items-center gap-1.5">
          <span
            :class="[
              chart.kind === 'bar' ? 'size-2.5 rounded-[2px]' : 'h-0.5 w-4 rounded-full',
              'shrink-0 forced-colors:forced-color-adjust-none',
            ]"
            :style="{ background: color(index) }"
          />
          {{ names[index] }}
        </li>
      </ul>
      <p v-else class="mb-3 text-xs font-medium text-toned">{{ names[0] }}</p>

      <ol v-if="chart.kind === 'bar'" class="space-y-3">
        <li v-for="(category, row) in chart.categories" :key="row">
          <p class="mb-1 font-medium text-highlighted">{{ category }}</p>
          <div class="relative space-y-0.5" :style="bars.track">
            <span class="absolute -inset-y-0.5 w-px bg-accented" :style="{ left: `${bars.zero}%` }" />
            <div v-for="(item, index) in chart.series" :key="index" class="relative h-4">
              <span
                v-if="item.values[row]"
                class="absolute inset-y-0 forced-colors:forced-color-adjust-none"
                :class="item.values[row]! < 0 ? 'rounded-l-[4px]' : 'rounded-r-[4px]'"
                :style="bars.bar(item.values[row]!, color(index))"
              />
              <span
                class="absolute top-1/2 -translate-y-1/2 text-xs leading-none whitespace-nowrap text-toned tabular-nums"
                :style="bars.label(item.values[row] ?? 0)"
              >
                {{ item.labels[row] || '–' }}
              </span>
            </div>
          </div>
        </li>
      </ol>

      <div v-else class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pt-1">
        <div class="relative h-52 sm:h-64" :style="{ width: `${line.axisWidth}ch` }">
          <span
            v-for="tick in line.ticks"
            :key="tick.value"
            class="absolute right-0 -translate-y-1/2 text-xs whitespace-nowrap text-muted tabular-nums"
            :style="{ top: `${tick.y}%` }"
          >
            {{ tick.text }}
          </span>
        </div>
        <div class="relative h-52 sm:h-64">
          <svg
            class="absolute inset-0 size-full overflow-visible forced-colors:forced-color-adjust-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              v-for="tick in line.ticks"
              :key="tick.value"
              x1="0"
              x2="100"
              :y1="tick.y"
              :y2="tick.y"
              :class="tick.value === 0 ? 'stroke-(--ui-border-accented)' : 'stroke-(--ui-border)'"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <path
              v-for="path in line.paths"
              :key="path.key"
              :d="path.d"
              :style="{ stroke: path.color }"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <!-- HTML dots stay round while the SVG stretches; the 24 px box is the hover target. -->
          <span
            v-for="point in line.points"
            :key="point.key"
            :title="point.title"
            class="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
            :class="{ 'max-sm:hidden': point.minor }"
            :style="{ left: `${point.x}%`, top: `${point.y}%` }"
          >
            <span
              class="size-2 rounded-full ring-2 ring-(--ui-bg) forced-colors:forced-color-adjust-none"
              :style="{ background: point.color }"
            />
          </span>
        </div>
        <div />
        <div class="relative mt-2 h-4 text-xs text-muted">
          <span
            v-for="tick in line.categories"
            :key="tick.index"
            class="absolute top-0 max-w-[33%] truncate sm:max-w-[13%]"
            :class="[tick.align, { 'max-sm:hidden': !tick.mobile, 'sm:hidden': !tick.desktop }]"
            :style="{ left: `${tick.x}%` }"
            :title="tick.text"
          >
            {{ tick.text }}
          </span>
        </div>
      </div>
    </div>

    <details class="group mt-4 border-t border-default pt-2">
      <summary
        class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-toned hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <UIcon name="mdi:table" class="size-4 shrink-0" />
        {{ $t('articles.chart.showData') }}
        <UIcon
          name="mdi:chevron-down"
          class="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <!-- `.article-table` styles the cells; the overrides cancel its full-bleed breakout inside the card. -->
      <!-- eslint-disable-next-line vue/no-v-html -- server-sanitised body (`sanitizeHtml` on write) -->
      <div
        class="article-table static! mt-2 w-full! transform-none! overflow-x-auto rounded-lg border border-default"
        v-html="html"
      />
    </details>
  </figure>
</template>

<script setup lang="ts">
import { chartTicks, readChartUnit, type ChartData } from '~~/shared/utils/articleChart'

const { chart, html } = defineProps<{ chart: ChartData; html: string }>()
const { t, locale } = useI18n()

const color = (index: number) => `var(--chart-${index + 1})`
const names = computed(() =>
  chart.series.map((item, index) => item.name || t('articles.chart.series', { n: index + 1 })),
)

const label = computed(() =>
  chart.kind === 'bar'
    ? t('articles.chart.bar', { series: names.value.join(', ') })
    : t('articles.chart.line', {
        series: names.value.join(', '),
        from: chart.categories[0],
        to: chart.categories.at(-1),
      }),
)

// Value labels sit outside the bar end, so each side reserves room for its longest label.
const bars = computed(() => {
  const values = chart.series.flatMap((item) => item.values.map((value) => value ?? 0))
  const min = Math.min(0, ...values)
  const span = Math.max(0, ...values) - min || 1
  const zero = (-min / span) * 100
  const reserve = (negative: boolean) => {
    const lengths = chart.series.flatMap((item) =>
      item.labels.filter((_, row) => (item.values[row] ?? 0) < 0 === negative).map((text) => text.length || 1),
    )
    return lengths.length ? `min(${Math.max(...lengths) + 1.5}ch, 40%)` : '0px'
  }

  return {
    zero,
    track: { marginLeft: reserve(true), marginRight: reserve(false) },
    bar: (value: number, background: string) => {
      const width = `max(2px, ${(Math.abs(value) / span) * 100}%)`
      return value < 0 ? { right: `${100 - zero}%`, width, background } : { left: `${zero}%`, width, background }
    },
    label: (value: number) => {
      const end = `${(Math.abs(value) / span) * 100}% + 0.375rem`
      return value < 0 ? { right: `calc(${100 - zero}% + ${end})` } : { left: `calc(${zero}% + ${end})` }
    },
  }
})

const pickIndexes = (count: number, max: number) =>
  new Set(
    Array.from({ length: Math.min(count, max) }, (_, i) =>
      Math.round((i * (count - 1)) / (Math.min(count, max) - 1 || 1)),
    ),
  )

// Rows of each unbroken run of values; a lone value between gaps gets a dot but no line.
const segments = (values: (number | null)[]) => {
  const runs: number[][] = [[]]
  values.forEach((value, row) => (value === null ? runs.push([]) : runs.at(-1)!.push(row)))
  return runs.filter((run) => run.length > 1)
}

const line = computed(() => {
  const values = chart.series.flatMap((item) => item.values.filter((value) => value !== null))
  let min = Math.min(...values)
  let max = Math.max(...values)
  // Lines need no zero baseline; pull it in only when the data already sits close to it.
  if (min > 0 && min <= max / 5) min = 0
  if (max < 0 && max >= min / 5) max = 0
  const ticks = chartTicks(min, max)
  const low = ticks[0]!
  const high = ticks.at(-1)!
  const count = chart.categories.length
  const x = (index: number) => (count > 1 ? (index / (count - 1)) * 100 : 50)
  const y = (value: number) => (1 - (value - low) / (high - low)) * 100

  const unit = readChartUnit(chart.series)
  const compact = Math.max(Math.abs(low), Math.abs(high)) >= 10_000
  const decimals = Math.max(...ticks.map((tick) => String(tick).split('.')[1]?.length ?? 0))
  const format = new Intl.NumberFormat(
    locale.value,
    compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: decimals },
  )
  const tickTexts = ticks.map((tick) => `${unit.prefix}${format.format(tick)}${unit.suffix}`)

  const desktop = pickIndexes(count, 6)
  const mobile = pickIndexes(count, 3)
  const dense = count > 24

  return {
    axisWidth: Math.max(...tickTexts.map((text) => text.length)) + 0.5,
    ticks: ticks.map((value, index) => ({ value, y: y(value), text: tickTexts[index] })),
    paths: chart.series.flatMap((item, index) =>
      segments(item.values).map((run, segment) => ({
        key: `${index}-${segment}`,
        d: `M${run.map((row) => `${x(row)},${y(item.values[row]!)}`).join('L')}`,
        color: color(index),
      })),
    ),
    // Dense series keep only isolated and final dots on phones, where every dot would merge into a band.
    points: chart.series.flatMap((item, index) =>
      item.values.flatMap((value, row) =>
        value === null
          ? []
          : [
              {
                key: `${index}-${row}`,
                x: x(row),
                y: y(value),
                color: color(index),
                title: `${chart.categories[row]} – ${names.value[index]}: ${item.labels[row]}`,
                minor:
                  dense &&
                  row < count - 1 &&
                  (item.values[row - 1] ?? null) !== null &&
                  (item.values[row + 1] ?? null) !== null,
              },
            ],
      ),
    ),
    categories: [...new Set([...desktop, ...mobile])].map((index) => ({
      index,
      x: x(index),
      text: chart.categories[index],
      desktop: desktop.has(index),
      mobile: mobile.has(index),
      align: index === 0 ? '' : index === count - 1 ? '-translate-x-full' : '-translate-x-1/2',
    })),
  }
})
</script>
