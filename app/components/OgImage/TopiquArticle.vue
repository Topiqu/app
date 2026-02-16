<template>
  <div class="w-full h-full flex relative bg-[#0f172a]">
    <img v-if="bgData" :src="bgData" class="w-full h-full object-cover" />
    <div v-else class="w-full h-full" :style="{ backgroundColor: themeColor || '#0f172a' }" />
  </div>
</template>

<script setup lang="ts">
import { Buffer } from 'node:buffer'

const props = defineProps<{
  backgroundImage?: string
  themeColor?: string
  title?: string
  description?: string
  siteName?: string
  domain?: string
}>()

const fetchAndConvertToBase64 = async (url: string | undefined) => {
  if (!url) return undefined
  if (url.startsWith('data:')) return url

  try {
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png&w=1200&q=80`

    const response = await $fetch(proxyUrl, {
      responseType: 'arrayBuffer',
      timeout: 2500,
    })

    if (!response) return undefined

    const base64 = Buffer.from(response as ArrayBuffer).toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (e) {
    return undefined
  }
}

const bgData = await fetchAndConvertToBase64(props.backgroundImage)
</script>
<!-- <template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white font-sans">
    <div class="absolute top-16 right-16">
      <img
        v-if="computedLogoUrl"
        :src="computedLogoUrl"
        width="140"
        height="140"
        style="width: 140px; height: 140px; object-fit: contain"
      />
      <div
        v-else
        class="h-[120px] w-[120px] rounded-xl bg-white/5 flex items-center justify-center text-5xl font-bold backdrop-blur-md border border-white/10 shadow-2xl"
      >
        {{ siteName[0] }}
      </div>
    </div>
    
    </div>
</template>

<script setup lang="ts">
// Žádný import Bufferu není potřeba!

const props = defineProps<{
  title: string
  description?: string
  siteName: string
  siteLogo?: string
  themeColor: string
  domain: string
}>()

const { origin } = useRequestURL()

// Pomocná funkce jen sestaví string, nic nestahuje = ŽÁDNÝ BLOCKING, ŽÁDNÝ LOOPBACK
const getProxyUrl = (url: string | undefined) => {
  if (!url) return undefined
  if (url.startsWith('data:')) return url
  
  // Tady sestavíme absolutní URL k tvé proxy.
  // Satori (v <template>) si na tuto URL sáhne samo zvenčí nebo interně, jak potřebuje.
  return `${origin}/api/og-proxy?url=${encodeURIComponent(url)}`
}

const computedLogoUrl = computed(() => getProxyUrl(props.siteLogo))
// const computedBgUrl = computed(() => getProxyUrl(props.backgroundImage)) // Pokud tam máš ten .webp
</script> -->
