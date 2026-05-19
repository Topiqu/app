<template>
  <div>
    <FormLabel v-if="label" :text="label" />
    <div class="flex flex-wrap gap-3">
      <label v-for="color in colors || defaultColors" :key="color" class="relative cursor-pointer group">
        <input v-model="modelValue" type="radio" :value="color" class="sr-only" />
        <div
          class="w-10 h-10 rounded-full border-2 transition-all duration-300 relative overflow-hidden"
          :class="[
            modelValue === color
              ? 'border-white dark:border-slate-900 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-indigo-500 scale-110 shadow-md'
              : 'border-transparent hover:scale-110',
          ]"
          :style="{ backgroundColor: getHexColor(color) }"
        ></div>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
const { colors, label } = defineProps<{
  label?: string
  colors?: string[]
}>()

const modelValue = defineModel<string>()

const defaultColors = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'green', 'teal']

const getHexColor = (colorName: string) => {
  const map: Record<string, string> = {
    blue: '#3b82f6',
    indigo: '#6366f1',
    purple: '#a855f7',
    pink: '#ec4899',
    red: '#ef4444',
    orange: '#f97316',
    green: '#22c55e',
    teal: '#14b8a6',
  }
  return map[colorName] || colorName
}
</script>
