<template>
  <VueEasyLightbox
    :visible="open"
    :imgs="images"
    :index
    teleport="body"
    loop
    @hide="open = false"
    @onIndexChange="onIndexChange"
  />
</template>

<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox'

// The source element scopes the query to the published body; the marker is applied during image
// rendering and avoids coupling zoom behavior to paragraph/figure or typography markup.
const { sourceRef, selector = 'img[data-article-lightbox]' } = defineProps<{
  sourceRef: HTMLElement | null
  selector?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const images = shallowRef<{ src: string; title?: string }[]>([])
const imageElements = shallowRef<HTMLImageElement[]>([])

const onIndexChange = (_oldIndex: number, newIndex: number) => {
  index.value = newIndex
}

const collect = () => {
  if (!sourceRef) return
  imageElements.value = [...sourceRef.querySelectorAll<HTMLImageElement>(selector)]
  images.value = imageElements.value.map((img) => ({
    src: img.currentSrc || img.src,
    title: img.alt || undefined,
  }))
}

watchEffect(collect)
useMutationObserver(() => sourceRef, collect, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset'],
})

useEventListener(
  () => sourceRef,
  'click',
  (e: MouseEvent) => {
    const img = (e.target as HTMLElement | null)?.closest<HTMLImageElement>('img')
    if (!img?.matches(selector)) return
    // `currentSrc` can switch after responsive `srcset` selection. Element identity is stable and
    // avoids losing the click merely because the browser picked a different optimized width.
    const i = imageElements.value.indexOf(img)
    if (i === -1) return
    images.value[i] = { src: img.currentSrc || img.src, title: img.alt || undefined }
    index.value = i
    open.value = true
  },
)

let lastFocused: HTMLElement | null = null
watch(open, (v) => {
  if (v) lastFocused = document.activeElement as HTMLElement | null
  else lastFocused?.focus?.()
})
</script>
