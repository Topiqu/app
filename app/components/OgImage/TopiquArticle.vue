<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white font-sans">
    <img v-if="bgData" :src="bgData" class="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105" />

    <div class="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent" />

    <div class="absolute top-12 left-12 flex items-center gap-4">
      <img
        v-if="logoData"
        :src="logoData"
        width="60"
        height="60"
        style="width: 60px; height: 60px; object-fit: contain"
      />
      <span class="text-2xl font-bold tracking-wider uppercase opacity-90">{{ siteName }}</span>
    </div>

    <div class="relative mt-auto p-16 pb-20 flex flex-col gap-8">
      <div v-if="category" class="flex">
        <span
          class="px-4 py-1 rounded-md text-sm font-bold uppercase tracking-widest text-white shadow-xl"
          :style="{ backgroundColor: themeColor }"
        >
          {{ category }}
        </span>
      </div>

      <h1 class="text-7xl font-black leading-[1.1] tracking-tight drop-shadow-2xl">
        {{ title }}
      </h1>

      <div class="flex items-center gap-6">
        <div class="flex flex-col">
          <span class="text-xl font-medium text-gray-300">{{ domain }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Buffer } from 'node:buffer'

const props = defineProps<{
  title: string
  siteName: string
  siteLogo?: string
  backgroundImage?: string
  themeColor: string
  domain: string
  category?: string
}>()

const { origin } = useRequestURL()

const fetchToDataUrl = async (targetUrl: string | undefined, type: string) => {
  if (!targetUrl) return undefined

  if (targetUrl.startsWith('data:')) return targetUrl

  try {
    const proxyUrl = `${origin}/api/og-proxy?url=${encodeURIComponent(targetUrl)}`

    console.log(`[OG ${type}] Fetching: ${proxyUrl}`)

    const response = await $fetch(proxyUrl, {
      responseType: 'arrayBuffer',
    })

    if (!response) {
      console.error(`[OG ${type}] Empty response`)
      return undefined
    }

    const base64 = Buffer.from(response as ArrayBuffer).toString('base64')
    return `data:image/png;base64,${base64}`
  } catch (e) {
    console.error(`[OG ${type}] Failed:`, e)
    return undefined
  }
}

const [logoData, bgData] = await Promise.all([
  fetchToDataUrl(props.siteLogo, 'LOGO'),
  fetchToDataUrl(props.backgroundImage, 'BG'),
])
</script>
