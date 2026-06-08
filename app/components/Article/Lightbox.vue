<template>
  <VueEasyLightbox
    :visible="open"
    :imgs="images"
    :index
    teleport="body"
    loop
    @hide="open = false"
    @on-index-change="(_o, n) => (index = n)"
  />
</template>

<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox'

const { sourceRef, selector = '.prose p img' } = defineProps<{
  sourceRef: HTMLElement | null
  selector?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const images = shallowRef<{ src: string; title?: string }[]>([])

const collect = () => {
  if (!sourceRef) return
  images.value = [...sourceRef.querySelectorAll<HTMLImageElement>(selector)].map((img) => ({
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
    const i = images.value.findIndex((x) => x.src === (img.currentSrc || img.src))
    if (i === -1) return
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
