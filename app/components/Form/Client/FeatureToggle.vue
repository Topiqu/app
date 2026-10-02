<template>
  <label
    class="flex h-full select-none flex-col gap-4 rounded-(--topiqu-surface-radius) border bg-default p-4 transition-colors"
    :class="[
      active ? 'border-primary' : 'border-default hover:border-accented',
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    ]"
  >
    <div class="flex items-start justify-between gap-3">
      <div
        class="grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
        :class="active ? 'bg-primary text-inverted' : 'bg-elevated text-muted'"
        aria-hidden="true"
      >
        <UIcon :name="icon" class="size-5" />
      </div>
      <USwitch :modelValue="enabled" :disabled :aria-label="title" @update:modelValue="emit('toggle')" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold text-highlighted">{{ title }}</div>
      <p class="mt-1 text-xs leading-5 text-muted">{{ description }}</p>
    </div>

    <div class="flex items-center gap-2 border-t border-default pt-3 text-xs">
      <span v-if="price" class="font-semibold text-highlighted">
        {{ price }}
        <span class="font-normal text-muted">
          /{{ billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly') }}
        </span>
      </span>
      <span v-else class="inline-flex items-center gap-1 font-medium text-success">
        <UIcon name="mdi:check-decagram-outline" class="size-3.5" />
        {{ $t('common.features.includedInPlan') }}
      </span>
      <span v-if="price && billingPlan === 'ANNUAL'" class="font-medium text-success">–20 %</span>
    </div>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string
  title: string
  description: string
  price: string | null
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  enabled: boolean
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const active = computed(() => props.enabled && !props.disabled)
</script>
