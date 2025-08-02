<template>
  <div class="rounded-lg shadow p-6 mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Zobrazení za poslední týden</h2>
      <button class="px-3 py-1.5 rounded border text-sm font-medium hover:bg-gray-100 transition" @click="toggleType">
        Přepnout na {{ chartType === 'bar' ? 'čárový' : 'sloupcový' }}
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
