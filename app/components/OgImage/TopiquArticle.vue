<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white font-sans">
    <img
      v-if="bgBase64"
      :src="bgBase64"
      class="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105"
    />

    <div
      class="absolute inset-0 w-full h-full opacity-40"
      :style="{ background: `linear-gradient(135deg, ${themeColor} 0%, #0f172a 100%)` }"
    />

    <div class="absolute inset-0 bg-black/20" />

    <div
      class="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full blur-[150px] opacity-25"
      :style="{ backgroundColor: themeColor }"
    />
    <div
      class="absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full blur-[120px] opacity-15"
      :style="{ backgroundColor: themeColor }"
    />

    <div class="absolute top-16 left-16 flex items-center gap-3 opacity-90">
      <div
        class="w-3 h-3 rounded-full shadow-lg"
        :style="{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }"
      />
      <span class="text-xl font-bold tracking-widest uppercase opacity-80">{{ siteName }}</span>
    </div>

    <div class="absolute top-16 right-16">
      <img
        v-if="logoBase64"
        :src="logoBase64"
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

    <div class="relative flex flex-col justify-end h-full p-16 pb-24">
      <div class="flex flex-col gap-6 max-w-4xl">
        <h1 class="text-8xl font-black leading-[0.95] text-white drop-shadow-2xl tracking-tight">
          {{ title }}
        </h1>
        <p v-if="description" class="text-4xl text-blue-100/80 line-clamp-2 leading-snug font-light max-w-5xl">
          {{ description }}
        </p>
      </div>
    </div>

    <div
      class="absolute bottom-16 left-16 flex items-center px-6 py-3 rounded-full bg-white/5 border border-white/5 backdrop-blur-xl"
    >
      <span class="text-xl font-medium tracking-wide text-gray-300">{{ domain }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Buffer } from 'node:buffer'

const props = defineProps<{
  title: string
  description?: string
  siteName: string
  siteLogo?: string
  themeColor: string
  domain: string
  backgroundImage?: string
}>()

const { origin } = useRequestURL()

const fetchToDataUrl = async (targetUrl: string | undefined) => {
  if (!targetUrl) return undefined
  if (targetUrl.startsWith('data:')) return targetUrl

  try {
    const proxyUrl = `${origin}/api/og-proxy?url=${encodeURIComponent(targetUrl)}`

    const response = await $fetch(proxyUrl, {
      responseType: 'arrayBuffer',
      timeout: 5000,
    })

    if (!response) return undefined

    const base64 = Buffer.from(response as ArrayBuffer).toString('base64')
    return `data:image/png;base64,${base64}`
  } catch {
    console.error(`Failed to load OG image: ${targetUrl}`)
    return undefined
  }
}

const [logoBase64, bgBase64] = await Promise.all([
  fetchToDataUrl(props.siteLogo),
  fetchToDataUrl(props.backgroundImage),
])
</script>
