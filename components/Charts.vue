<template>
  <div class="bg-white rounded-lg shadow p-6 mt-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Denní úkoly</h2>
      <button
        class="px-3 py-1.5 rounded border text-sm font-medium hover:bg-gray-100 transition bg-white border-coolGray"
        @click="toggleType"
      >
        Přepnout na {{ chartType === 'bar' ? 'čárový' : 'sloupcový' }}
      </button>
    </div>
    <div class="relative h-64">
      <component :is="currentChart" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
import { Bar, Line } from 'vue-chartjs'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
)

const chartType = ref<'bar' | 'line'>('bar')
const toggleType = () => {
  chartType.value = chartType.value === 'bar' ? 'line' : 'bar'
}

const currentChart = computed(() => (chartType.value === 'bar' ? Bar : Line))

const chartData = {
  labels: ['Po', 'Út', 'St', 'Čt', 'Pá'],
  datasets: [
    {
      label: 'Úkoly dokončeny',
      data: [3, 7, 5, 6, 2],
      backgroundColor: '#3b82f6',
    },
  ],
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
}
</script>
