<template>
  <Transition
    enterActiveClass="transition-all duration-300 ease-out"
    leaveActiveClass="transition-all duration-300 ease-in"
    enterFromClass="opacity-0 max-h-0"
    enterToClass="opacity-100 max-h-[1000px]"
    leaveFromClass="opacity-100 max-h-[1000px]"
    leaveToClass="opacity-0 max-h-0"
  >
    <div v-show="!isEmpty" class="flex flex-col items-center my-4">
      <div v-if="showLabel" class="text-[10px] uppercase tracking-widest text-gray-400 mb-1 self-start md:self-center">
        {{ $t('common.advertisement', 'Ad') }}
      </div>

      <div
        class="relative overflow-hidden bg-gray-50/50 dark:bg-gray-900/20"
        :style="{
          width: slotWidth,
          minHeight: loading ? reservedHeight : 'auto',
          height: slotHeight,
        }"
      >
        <div
          v-if="loading"
          class="absolute inset-0 z-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm"
        >
          <span class="text-xs font-medium text-gray-400">{{ $t('common.loading') }}</span>
        </div>

        <div :id="internalSlotId"></div>
      </div>
    </div>
  </Transition>
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
  showLabel?: boolean
}>()

const loading = shallowRef(true)
const isEmpty = shallowRef(false)
const { defineSlot, destroySlots } = useGamAds()

const internalSlotId = props.slotId ?? `gpt-ad-${Date.now()}-${Math.floor(Math.random() * 1000)}`

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

const slotWidth = computed(() => props.width || '100%')
const slotHeight = computed(() => (props.sizes === 'fluid' ? 'auto' : props.height || 'auto'))

onMounted(async () => {
  if (window.googletag && window.googletag.cmd) {
    window.googletag.cmd.push(() => {
      const pubads = window.googletag.pubads() as any

      pubads.addEventListener('slotRenderEnded', (event: any) => {
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
