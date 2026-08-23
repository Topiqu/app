<template>
  <label
    class="flex items-start gap-3 py-3 px-4 rounded-lg border transition-all duration-200 select-none cursor-pointer"
    :class="[
      active ? `${accentRing} border-transparent bg-white dark:bg-gray-800` : idleClass,
      disabled && 'opacity-60 cursor-not-allowed',
    ]"
  >
    <Icon :name="icon" class="w-6 h-6 mt-0.5 flex-shrink-0" :class="accentIcon" />
    <div class="flex-1 min-w-0">
      <div class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ title }}</div>
      <div class="text-xs text-gray-600 dark:text-gray-400 leading-tight">{{ description }}</div>
      <div class="mt-1 flex items-center gap-2 text-xs">
        <span v-if="price" class="font-semibold text-gray-900 dark:text-gray-100">
          {{ price }}
          <span class="text-gray-500 font-normal">
            /{{ billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly') }}
          </span>
        </span>
        <span v-else class="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
          <Icon name="mdi:check-decagram-outline" class="w-3.5 h-3.5" />
          {{ $t('common.features.includedInPlan') }}
        </span>
        <span v-if="price && billingPlan === 'ANNUAL'" class="text-emerald-600 dark:text-emerald-400 font-medium">
          –20 %
        </span>
      </div>
    </div>
    <div class="w-5 h-5 flex-shrink-0">
      <UCheckbox :modelValue="enabled" :disabled class="pointer-events-none" @update:modelValue="emit('toggle')" />
    </div>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string
  accentRing: string
  accentIcon: string
  title: string
  description: string
  price: string | null
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  enabled: boolean
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const idleClass =
  'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'

const active = computed(() => props.enabled && !props.disabled)
</script>
