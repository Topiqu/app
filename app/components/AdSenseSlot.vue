<template>
  <div
    v-show="status !== 'error' && !failed"
    class="flex flex-col items-center has-[ins[data-ad-status=unfilled]]:hidden"
  >
    <span class="mb-1 text-[10px] uppercase tracking-widest text-muted">{{ $t('common.advertisement') }}</span>
    <ins
      ref="unit"
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
withDefaults(
  defineProps<{
    adSlot: string
    format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical'
    fullWidthResponsive?: boolean
  }>(),
  { format: 'auto', fullWidthResponsive: true },
)

const publisherId = String(useRuntimeConfig().public.adsensePublisherId || '').trim()
const status = useAdSenseStatus()
const unit = useTemplateRef<HTMLElement>('unit')
const failed = shallowRef(false)
let requested = false

const requestAd = () => {
  if (status.value !== 'ready' || requested || failed.value || !unit.value?.clientWidth) return
  const queue = ((window as { adsbygoogle?: unknown[] }).adsbygoogle ??= [])
  try {
    queue.push({})
    requested = true
  } catch (error) {
    failed.value = true
    console.warn('[AdSense] Could not initialize the ad unit.', error)
  }
}

onMounted(requestAd)
watch(status, requestAd, { flush: 'post' })
// A slot can mount while its parent is hidden or is still being laid out.
useResizeObserver(unit, requestAd)
</script>
