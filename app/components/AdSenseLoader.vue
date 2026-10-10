<template>
  <slot />
</template>

<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>()
const publisherId = String(useRuntimeConfig().public.adsensePublisherId || '').trim()
const status = useAdSenseStatus()
const hydrated = shallowRef(false)
let script: HTMLScriptElement | null = null

onNuxtReady(() => {
  hydrated.value = true
})

watch(
  [() => props.enabled && Boolean(publisherId), hydrated],
  ([enabled, ready]) => {
    if (!enabled) {
      script?.remove()
      script = null
      status.value = 'idle'
      return
    }
    if (script) return
    status.value = 'loading'
    if (!ready) return

    const adWindow = window as unknown as { adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number } }
    const queue = (adWindow.adsbygoogle ??= [])
    queue.requestNonPersonalizedAds = 1

    // AdSense validates its head tag. Unhead adds data-hid and event marker attributes,
    // so insert a plain script only after hydration and attach listeners through the DOM.
    const element = document.createElement('script')
    element.setAttribute('async', '')
    element.crossOrigin = 'anonymous'
    element.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`
    element.addEventListener('load', () => {
      if (script === element && props.enabled) status.value = 'ready'
    })
    element.addEventListener('error', () => {
      if (script === element && props.enabled) status.value = 'error'
    })
    script = element
    document.head.appendChild(element)
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  script?.remove()
  script = null
  status.value = 'idle'
})

useHead(() => ({
  meta:
    props.enabled && publisherId
      ? [{ key: 'adsense-account', name: 'google-adsense-account', content: publisherId }]
      : [],
}))
</script>
