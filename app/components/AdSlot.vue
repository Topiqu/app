<template>
  <div v-show="!isEmpty" class="relative overflow-hidden" :style="{ width: slotWidth, height: slotHeight }">
    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"
    >
      <span class="text-xs font-medium text-gray-400">{{ $t('common.loading') }}</span>
    </div>

    <div :id="internalSlotId" class="w-full h-full"></div>
  </div>
</template>

<script setup lang="ts">
/// <reference types="@types/google-publisher-tag" />

const props = defineProps<{
  adUnitPath: string
  sizes: number[][] | 'fluid'
  slotId?: string
  targeting?: Record<string, string | string[]>
  width?: string
  height?: string
}>()

const loading = shallowRef(true)
const isEmpty = shallowRef(false)
const { defineSlot, destroySlots } = useGamAds()

const internalSlotId = props.slotId ?? `gpt-ad-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const slotWidth = computed(() => props.width || '100%')
const slotHeight = computed(() => (props.sizes === 'fluid' ? 'auto' : props.height || 'auto'))

onMounted(async () => {
  if (window.googletag && window.googletag.cmd) {
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
        if (event.slot.getSlotElementId() === internalSlotId) {
          loading.value = false
          isEmpty.value = event.isEmpty
        }
      })
    })
  }

  await defineSlot(props.adUnitPath, props.sizes as googletag.GeneralSize, internalSlotId, props.targeting)
})

onBeforeUnmount(() => {
  destroySlots([internalSlotId])
})
</script>
