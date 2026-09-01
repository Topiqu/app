<template>
  <div
    ref="mediaRoot"
    class="app-media relative overflow-hidden bg-elevated"
    :class="[
      containerClass,
      mediaState === 'fallback' && fallbackBorder ? 'border border-dashed border-default bg-elevated' : '',
    ]"
    :style="{ aspectRatio }"
    :aria-busy="isRetrying || undefined"
    :data-media-state="mediaState"
  >
    <NuxtImg
      v-if="currentSrc && shouldOptimize"
      :src="currentSrc"
      :alt="alt"
      :width="width"
      :height="height"
      format="webp"
      :quality="82"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      :sizes="sizes"
      class="absolute inset-0 size-full transition-opacity"
      :class="[fit === 'contain' ? 'object-contain' : 'object-cover', hasLoaded ? 'opacity-100' : 'opacity-0']"
      @load="handleMediaLoad"
      @error="handleMediaError"
    />
    <img
      v-else-if="currentSrc"
      :src="currentSrc"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      class="absolute inset-0 size-full transition-opacity"
      :class="[fit === 'contain' ? 'object-contain' : 'object-cover', hasLoaded ? 'opacity-100' : 'opacity-0']"
      @load="handleMediaLoad"
      @error="handleMediaError"
    />
    <USkeleton v-if="isRetrying" class="absolute inset-0" />
    <div v-if="!hasLoaded && !isRetrying" class="absolute inset-0 z-[1] grid place-items-center text-muted">
      <span v-if="fallbackText" class="app-media__monogram font-bold text-highlighted" aria-hidden="true">{{
        monogram
      }}</span>
      <UIcon v-else :name="fallbackIcon" size="32" aria-hidden="true" />
      <span class="sr-only">{{ alt }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { canOptimizeImageUrl } from '~~/shared/utils/imageHosts'

const {
  src = null,
  originalSrc = null,
  alt,
  aspectRatio = '3 / 2',
  fit = 'cover',
  fallbackIcon = 'mdi:image-outline',
  fallbackBorder = false,
  fallbackText,
  priority = false,
  sizes = '100vw sm:50vw lg:33vw',
  width,
  height,
  containerClass = '',
} = defineProps<{
  src?: string | null
  originalSrc?: string | null
  alt: string
  aspectRatio?: string
  fit?: 'cover' | 'contain'
  fallbackIcon?: string
  fallbackBorder?: boolean
  fallbackText?: string
  priority?: boolean
  sizes?: string
  width?: number
  height?: number
  containerClass?: string
}>()

const { currentSrc, isRetrying, usingOriginal, handleError, handleLoad } = useImageRetry(
  () => src,
  () => originalSrc,
)
const hasLoaded = shallowRef(false)
const mediaRoot = useTemplateRef<HTMLElement>('mediaRoot')
const shouldOptimize = computed(() =>
  // Nuxt Image treats a query string as part of the IPX source path. Once a
  // cache-busting retry starts, request the source directly so
  // `?topiqu_retry=…` remains a query instead of becoming `%3F…` in the path.
  Boolean(currentSrc.value && !isRetrying.value && !usingOriginal.value && canOptimizeImageUrl(currentSrc.value)),
)

let loadTimeout: ReturnType<typeof setTimeout> | null = null
const clearLoadTimeout = () => {
  if (loadTimeout) clearTimeout(loadTimeout)
  loadTimeout = null
}

const handleMediaError = () => {
  clearLoadTimeout()
  handleError()
}

const handleMediaLoad = () => {
  clearLoadTimeout()
  hasLoaded.value = true
  handleLoad()
}

watch(
  currentSrc,
  () => {
    clearLoadTimeout()
    hasLoaded.value = false
    if (currentSrc.value) loadTimeout = setTimeout(handleMediaError, priority ? 2000 : 4000)
  },
  { immediate: true },
)

onMounted(() => {
  const image = mediaRoot.value?.querySelector('img')
  if (!image?.complete) return
  if (image.naturalWidth > 0) handleMediaLoad()
  else handleMediaError()
})
onUnmounted(clearLoadTimeout)
const mediaState = computed(() => {
  if (hasLoaded.value) return 'loaded'
  if (currentSrc.value || isRetrying.value) return 'loading'
  return 'fallback'
})
const monogram = computed(() => (fallbackText || '').trim().slice(0, 2).toLocaleUpperCase())
</script>

<style scoped>
.app-media {
  container-type: inline-size;
}

.app-media__monogram {
  font-size: clamp(1rem, 18cqi, 3.5rem);
}
</style>
