<template>
  <UCard as="figure" class="h-full min-w-0" :ui="{ body: 'flex h-full min-w-0 flex-col' }">
    <span ref="colorProbe" class="hidden" aria-hidden="true">
      <span class="text-highlighted" /><span class="text-default" /><span class="text-toned" />
      <span class="text-muted" /><span class="text-dimmed" /><span class="text-default border-default bg-default" />
    </span>
    <figcaption class="mb-4 flex min-w-0 items-start justify-between gap-3">
      <h2 class="min-w-0 text-lg font-semibold sm:text-xl">{{ title }}</h2>
      <UButton
        color="neutral"
        variant="soft"
        square
        :icon="nextTypeIcon"
        :aria-label="$t('stats.charts.toggleType')"
        @click="toggleType"
      />
    </figcaption>

    <div class="relative h-72 min-w-0 w-full">
      <component
        :is="currentChart"
        :key="chartType"
        :data="chartData"
        :options="chartOptions"
        :plugins="valueLabels"
        :aria-label="title"
      />
    </div>

    <!-- The table twin: the values stay readable when the colours don't carry them. -->
    <details class="mt-auto pt-4 text-sm">
      <summary class="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        {{ $t('stats.charts.showTable') }}
      </summary>
      <UTable :data="tableRows" :columns="tableColumns">
        <template #category-cell="{ row }">
          <span class="inline-flex items-center gap-2">
            <UIcon
              v-if="row.original.icon"
              :name="row.original.icon"
              class="size-5 shrink-0"
              :style="{ color: row.original.color }"
            />
            <span>{{ row.original.category }}</span>
          </span>
        </template>
      </UTable>
    </details>
  </UCard>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Chart, ChartOptions, Plugin } from 'chart.js'

import { Bar, Line, Pie } from 'vue-chartjs'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  PieController,
  ArcElement,
)

const props = defineProps<{
  title: string
  // `trend` is a value over time (bar ↔ line); `breakdown` is one measure split across
  // named entities (horizontal bar ↔ pie).
  kind: 'trend' | 'breakdown'
  label: string
  categoryHeading: string
  labels: string[]
  values: number[]
  /** Per-row icon names for the table twin, parallel to `labels`. */
  icons?: string[]
  /** Stable brand/category colours, with a contrast-safe value for each colour mode. */
  colors?: { light: string; dark: string }[]
}>()

const theme = useThemeStore()
const colorProbe = useTemplateRef<HTMLElement>('colorProbe')
const palette = shallowRef<string[]>(['currentColor'])
const ink = shallowRef({ muted: 'currentColor', grid: 'transparent', surface: 'transparent' })
// Canvas cannot resolve CSS variables. Read the same semantic colours used by the surrounding UI.
const syncColors = () => {
  if (!colorProbe.value) return
  const styles = Array.from(colorProbe.value.children, (element) => getComputedStyle(element))
  palette.value = styles.slice(0, 5).map((style) => style.color)
  const surface = styles[5]!
  ink.value = { muted: styles[3]!.color, grid: surface.borderColor, surface: surface.backgroundColor }
}
onMounted(syncColors)
watch(() => theme.isDark, syncColors, { flush: 'post' })

const chartType = shallowRef<'bar' | 'line' | 'pie'>('bar')
const alternate = computed(() => (props.kind === 'trend' ? 'line' : 'pie'))

const toggleType = () => {
  chartType.value = chartType.value === 'bar' ? alternate.value : 'bar'
}

const nextTypeIcon = computed(() =>
  chartType.value === 'bar' ? (alternate.value === 'line' ? 'mdi:chart-line' : 'mdi:chart-pie') : 'mdi:chart-bar',
)

const currentChart = computed(() => {
  if (chartType.value === 'line') return Line
  if (chartType.value === 'pie') return Pie
  return Bar
})

const isBreakdown = computed(() => props.kind === 'breakdown')
const categoryColors = computed(() =>
  props.labels.map((_, index) => {
    const brand = props.colors?.[index]
    return brand ? (theme.isDark ? brand.dark : brand.light) : palette.value[index % palette.value.length]!
  }),
)
const tableRows = computed(() =>
  props.labels.map((category, index) => ({
    category,
    value: props.values[index] ?? 0,
    icon: props.icons?.[index],
    color: categoryColors.value[index],
  })),
)
const tableColumns = computed<TableColumn<(typeof tableRows.value)[number]>[]>(() => [
  { accessorKey: 'category', header: props.categoryHeading },
  { accessorKey: 'value', header: props.label },
])

const chartData = computed(() => {
  // A trend is one series, so it is one colour; a breakdown colours by entity, which is
  // what the pie needs and what keeps the two views of it consistent.
  const colors = chartType.value === 'pie' ? categoryColors.value : (palette.value[2] ?? palette.value[0]!)

  return {
    labels: props.labels,
    datasets: [
      {
        label: props.label,
        data: props.values,
        backgroundColor: colors,
        borderColor: chartType.value === 'pie' ? ink.value.surface : colors,
        borderWidth: chartType.value === 'pie' ? 2 : chartType.value === 'line' ? 2 : 0,
        borderRadius: 4,
        borderSkipped: 'start' as const,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointBorderWidth: 2,
        pointBorderColor: ink.value.surface,
        pointBackgroundColor: colors,
      },
    ],
  }
})

// Typed to the one chart type rather than the union the component actually renders:
// `ChartOptions<A|B|C>` is not assignable to `ChartOptions<A> | ChartOptions<B> | ChartOptions<C>`,
// because TType sits in the parameter of every scriptable option and so compares contravariantly.
// Nothing below is scriptable, so all three controllers accept this object at runtime.
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // Horizontal, so entity names read as labels instead of rotated ticks.
  indexAxis: isBreakdown.value && chartType.value === 'bar' ? 'y' : 'x',
  layout: { padding: { right: isBreakdown.value && chartType.value === 'bar' ? 28 : 0 } },
  plugins: {
    // One series needs no legend — the title names it. The pie has no axis, so it keeps one.
    legend: { display: chartType.value === 'pie', position: 'right', labels: { color: ink.value.muted, boxWidth: 12 } },
    tooltip: { displayColors: false, padding: 10 },
  },
  scales:
    chartType.value === 'pie'
      ? undefined
      : {
          x: {
            beginAtZero: true,
            ticks: { color: ink.value.muted, precision: 0 },
            grid: { display: isBreakdown.value, color: ink.value.grid },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: ink.value.muted, precision: 0 },
            grid: { display: !isBreakdown.value, color: ink.value.grid },
            border: { display: false },
          },
        },
}))

// Bar-end values, so a low-contrast fill never carries the number on its own. Inline rather
// than chartjs-plugin-datalabels — a dozen lines beats a dependency.
const valueLabels = computed<Plugin<'bar'>[]>(() =>
  chartType.value === 'pie'
    ? []
    : [
        {
          id: 'valueLabels',
          afterDatasetsDraw(chart: Chart<'bar'>) {
            const { ctx } = chart
            ctx.save()
            ctx.fillStyle = ink.value.muted
            ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", sans-serif'

            chart.getDatasetMeta(0).data.forEach((element, i) => {
              const value = props.values[i]
              if (!value) return

              if (isBreakdown.value) {
                ctx.textAlign = 'left'
                ctx.textBaseline = 'middle'
                ctx.fillText(String(value), element.x + 8, element.y)
              } else {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'bottom'
                ctx.fillText(String(value), element.x, element.y - 6)
              }
            })
            ctx.restore()
          },
        },
      ],
)
</script>
