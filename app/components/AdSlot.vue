<template>
  <Transition
    enterActiveClass="transition-all duration-300 ease-out"
    leaveActiveClass="transition-all duration-300 ease-in"
    enterFromClass="opacity-0 max-h-0"
    enterToClass="opacity-100 max-h-[1000px]"
    leaveFromClass="opacity-100 max-h-[1000px]"
    leaveToClass="opacity-0 max-h-0"
  >
    <div v-show="!isEmpty" class="my-4 flex flex-col items-center">
      <div v-if="showLabel" class="mb-1 self-start text-[10px] tracking-widest text-gray-400 uppercase md:self-center">
        {{ $t('common.advertisement', 'Ad') }}
      </div>

      <div
        class="relative overflow-hidden"
        :style="{
          width: props.width || '100%',
          minHeight: loading ? reservedHeight : 'auto',
          height: props.sizes === 'fluid' ? 'auto' : props.height || 'auto',
        }"
      >
        <USkeleton v-if="loading" class="absolute inset-0 z-10" :aria-label="$t('common.loading')" />

        <div :id="internalSlotId"></div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/// <reference types="@types/google-publisher-tag" />

import type { GamSizeMapping } from '~/composables/useGam'

const props = defineProps<{
  adUnitPath: string
  sizes: number[][] | 'fluid'
  slotId?: string
  targeting?: Record<string, string | string[]>
  width?: string
  height?: string
  showLabel?: boolean
  sizeMapping?: GamSizeMapping[]
}>()

const loading = shallowRef(true)
const isEmpty = shallowRef(false)
const gam = useGamAds()

const internalSlotId = props.slotId ?? useId()

const reservedHeight = computed(() => {
  if (props.height) return props.height
  if (props.sizes === 'fluid') return '0px'

  if (Array.isArray(props.sizes) && props.sizes.length > 0) {
    const firstSize = props.sizes[0]
    if (Array.isArray(firstSize) && firstSize.length === 2) {
      return `${firstSize[1]}px`
    }
  }
  return 'auto'
})

const loadSlot = async () => {
  const initialized = await gam.initialize()
  if (!initialized || !window.googletag) {
    loading.value = false
    isEmpty.value = true
    return
  }

  window.googletag.cmd.push(() => {
    const pubads = window.googletag.pubads()

    pubads.addEventListener('slotRenderEnded', (event) => {
      if (event.slot.getSlotElementId() === internalSlotId) {
        loading.value = false
        isEmpty.value = event.isEmpty
      }
    })
  })

  const defined = await gam.defineSlot(
    props.adUnitPath,
    props.sizes as googletag.GeneralSize,
    internalSlotId,
    props.targeting,
    props.sizeMapping,
  )
  if (!defined) {
    loading.value = false
    isEmpty.value = true
  }
}

onMounted(loadSlot)

onBeforeUnmount(() => {
  gam.destroySlots([internalSlotId])
})
</script>
