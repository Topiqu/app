<template>
  <figure class="rounded-lg shadow p-6 mt-6">
    <figcaption class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">{{ title }}</h2>
      <Button
        variant="neutral"
        class="!rounded-full"
        :icon="nextTypeIcon"
        :aria-label="$t('stats.charts.toggleType')"
        @click="toggleType"
      />
    </figcaption>

    <div class="relative h-72">
      <component :is="currentChart" :key="chartType" :data="chartData" :options="chartOptions" :plugins="valueLabels" />
    </div>

    <!-- The table twin: the values stay readable when the colours don't carry them. -->
    <details class="mt-4 text-sm">
      <summary class="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        {{ $t('stats.charts.showTable') }}
      </summary>
      <table class="mt-3 w-full text-left tabular-nums">
        <thead>
          <tr class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th scope="col" class="py-1 font-medium">{{ categoryHeading }}</th>
            <th scope="col" class="py-1 font-medium text-right">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(name, i) in labels" :key="name" class="border-t border-gray-100 dark:border-gray-800">
            <td class="py-1">
              <span class="inline-flex items-center gap-2">
                <!-- Only a breakdown colours by entity; a trend is one series, so a per-row
                     swatch there would invent a distinction the chart does not make. -->
                <span
                  v-if="isBreakdown"
                  class="size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-neutral-900"
                  :style="{ backgroundColor: palette[i % palette.length] }"
                />
                <Icon v-if="icons?.[i]" :name="icons[i]!" class="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                {{ name }}
              </span>
            </td>
            <td class="py-1 text-right">{{ values[i] ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<script setup lang="ts">
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

// Validated categorical slots (adjacent CVD ΔE 9.1 light / 8.4 dark). Fixed order: a series
// keeps its hue when neighbours drop out. Light mode sits under 3:1 on three slots, which is
// why every value is also on an axis, a bar-end label and the table twin.
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
}

const INK = {
  light: { muted: '#898781', grid: '#e1e0d9', surface: '#ffffff' },
  dark: { muted: '#898781', grid: '#2c2c2a', surface: '#171717' },
}

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
}>()

const theme = useThemeStore()
const palette = computed(() => (theme.isDark ? SERIES.dark : SERIES.light))
const ink = computed(() => (theme.isDark ? INK.dark : INK.light))

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

const chartData = computed(() => {
  // A trend is one series, so it is one colour; a breakdown colours by entity, which is
  // what the pie needs and what keeps the two views of it consistent.
  const colors = isBreakdown.value
    ? props.labels.map((_, i) => palette.value[i % palette.value.length]!)
    : palette.value[0]!

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

const chartOptions = computed<ChartOptions<'bar' | 'line' | 'pie'>>(() => ({
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
const valueLabels = computed<Plugin[]>(() =>
  chartType.value === 'pie'
    ? []
    : [
        {
          id: 'valueLabels',
          afterDatasetsDraw(chart: Chart) {
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
