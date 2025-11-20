<template>
  <div
    :id="internalSlotId"
    :class="['ad-slot', { 'ad-loading': loading }]"
    :style="{ width: slotWidth, height: slotHeight }"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef, computed } from 'vue'

interface Props {
  adUnitPath: string
  sizes: number[][]
  slotId?: string
  targeting?: Record<string, string | string[]>
  width?: string
  height?: string
}

const props = defineProps<Props>()

const loading = shallowRef(true)
const { defineSlot, destroySlots } = useGamAds()

const internalSlotId = props.slotId ?? `gpt-ad-${Date.now()}-${Math.random().toString(36).slice(2)}`
const slotWidth = computed(() => props.width || '100%')
const slotHeight = computed(() => props.height || 'auto')

onMounted(async () => {
  await defineSlot(props.adUnitPath, props.sizes, internalSlotId, props.targeting)
  loading.value = false
})

onBeforeUnmount(() => {
  destroySlots([internalSlotId])
})
</script>

<style scoped>
.ad-slot {
  position: relative;
  min-height: 250px;
  background: #f0f0f0;
  border: 1px dashed #ccc;
}

.ad-loading::after {
  content: 'Nahrávám reklamu...';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #666;
  font-size: 14px;
}
</style>
