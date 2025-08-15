<template>
  <div class="rounded-lg shadow p-6 mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Zobrazení za poslední týden</h2>
      <button class="p-2 flex items-center gap-2 rounded-full border-none bg-transparent" @click="toggleType">
        <Icon :name="chartType === 'bar' ? 'mdi:chart-line' : 'mdi:chart-bar'" class="w-6 h-6" />
      </button>
    </div>
    <div class="relative h-64">
      <component :is="currentChart" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bar, Line } from 'vue-chartjs'
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
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, LineElement, PointElement, CategoryScale, LinearScale)

defineProps<{
  chartData: {
    labels: string[]
    datasets: {
      label: string
      data: number[]
      backgroundColor: string
      borderColor?: string
      fill?: boolean
    }[]
  }
}>()

const chartType = ref<'bar' | 'line'>('bar')
const toggleType = () => {
  chartType.value = chartType.value === 'bar' ? 'line' : 'bar'
}
const currentChart = computed(() => (chartType.value === 'bar' ? Bar : Line))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}
</script>
