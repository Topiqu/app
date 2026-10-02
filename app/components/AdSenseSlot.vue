<template>
  <div class="flex flex-col items-center has-[ins[data-ad-status=unfilled]]:hidden">
    <span class="mb-1 text-[10px] uppercase tracking-widest text-muted">{{ $t('common.advertisement') }}</span>
    <ins
      class="adsbygoogle block w-full"
      :data-ad-client="publisherId"
      :data-ad-slot="adSlot"
      :data-ad-format="format"
      :data-full-width-responsive="String(fullWidthResponsive)"
    />
  </div>
</template>

<script setup lang="ts">
// Mount only where the slot has width: AdSense throws on a zero-width (e.g. `display: none`) container.
const {
  adSlot,
  format = 'auto',
  fullWidthResponsive = true,
} = defineProps<{
  adSlot: string
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical'
  fullWidthResponsive?: boolean
}>()

const publisherId = String(useRuntimeConfig().public.adsensePublisherId || '').trim()

onMounted(() => {
  // `AdSenseLoader` may still be fetching the script; the queue is drained once it lands.
  const queue = ((window as { adsbygoogle?: unknown[] }).adsbygoogle ??= [])
  queue.push({})
})
</script>
