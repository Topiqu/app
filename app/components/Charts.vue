<template>
  <div class="rounded-lg shadow p-6 mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">{{ title }}</h2>
      <Button
        variant="neutral"
        class="!rounded-full"
        :icon="
          chartType === 'bar'
            ? 'mdi:chart-line'
            : chartType === 'line' && data?.user.plan !== 'BASIC'
              ? 'mdi:chart-pie'
              : 'mdi:chart-bar'
        "
        @click="toggleType"
      />
    </div>
    <div class="relative h-64">
      <component :is="currentChart" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bar, Line, Pie } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  PieController,
  ArcElement,
} from 'chart.js'

const { data } = useAuth()

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
  chartData: {
    labels: string[]
    datasets: {
      label: string
      data: number[]
      backgroundColor: string | string[]
      borderColor?: string
      fill?: boolean
    }[]
  }
  title: string
}>()

const isShareChart = (title: string) => title === 'Rozdělení sdílení podle platforem'

const chartType = shallowRef<'bar' | 'line' | 'pie'>(isShareChart(props.title) ? 'pie' : 'bar')

const toggleType = () => {
  if (data?.value?.user.plan === 'BASIC') {
    chartType.value = chartType.value === 'bar' ? 'line' : 'bar'
  } else {
    chartType.value = chartType.value === 'bar' ? 'line' : chartType.value === 'line' ? 'pie' : 'bar'
  }
}

const currentChart = computed(() => {
  if (chartType.value === 'bar') return Bar
  if (chartType.value === 'line') return Line
  return Pie
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: isShareChart(props.title) ? ('right' as const) : ('top' as const) },
  },
}))
</script>
