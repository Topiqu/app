<template>
  <div
    class="relative overflow-hidden bg-elevated"
    :class="containerClass"
    :style="{ aspectRatio }"
    :aria-busy="isRetrying || undefined"
    :data-media-state="mediaState"
  >
    <img
      v-if="currentSrc"
      ref="imageElement"
      :src="currentSrc"
      :alt="alt"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      :sizes="sizes"
      class="absolute inset-0 size-full transition-opacity"
      :class="[fit === 'contain' ? 'object-contain' : 'object-cover', hasLoaded ? 'opacity-100' : 'opacity-0']"
      @load="handleMediaLoad"
      @error="handleMediaError"
    />
    <USkeleton v-if="isRetrying" class="absolute inset-0" />
    <div v-if="!hasLoaded && !isRetrying" class="absolute inset-0 grid place-items-center text-muted">
      <span v-if="fallbackText" class="text-lg font-bold text-highlighted" aria-hidden="true">{{ monogram }}</span>
      <UIcon v-else :name="fallbackIcon" size="32" aria-hidden="true" />
      <span class="sr-only">{{ alt }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src?: string | null
    originalSrc?: string | null
    alt: string
    aspectRatio?: string
    fit?: 'cover' | 'contain'
    fallbackIcon?: string
    fallbackText?: string
    priority?: boolean
    sizes?: string
    containerClass?: string
  }>(),
  {
    src: null,
    originalSrc: null,
    aspectRatio: '3 / 2',
    fit: 'cover',
    fallbackIcon: 'i-mdi-image-outline',
    priority: false,
    sizes: '100vw sm:50vw lg:33vw',
    containerClass: '',
  },
)

const { currentSrc, isRetrying, handleError, handleLoad } = useImageRetry(
  () => props.src,
  () => props.originalSrc,
)
const hasLoaded = shallowRef(false)
const imageElement = useTemplateRef<HTMLImageElement>('imageElement')

watch(currentSrc, () => {
  hasLoaded.value = false
})

const handleMediaError = () => {
  handleError()
}

const handleMediaLoad = () => {
  hasLoaded.value = true
  handleLoad()
}

onMounted(() => {
  if (!imageElement.value?.complete) return
  if (imageElement.value.naturalWidth > 0) handleMediaLoad()
  else handleMediaError()
})
const mediaState = computed(() => {
  if (hasLoaded.value) return 'loaded'
  if (currentSrc.value || isRetrying.value) return 'loading'
  return 'fallback'
})
const monogram = computed(() => (props.fallbackText || '').trim().slice(0, 2).toLocaleUpperCase())
</script>
