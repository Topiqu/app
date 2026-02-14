<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white">
    <div
      class="absolute inset-0 w-full h-full opacity-40"
      :style="{ background: `linear-gradient(135deg, ${themeColor} 0%, #0f172a 100%)` }"
    />
    <div class="absolute inset-0 bg-black/20" />

    <div class="relative z-10 w-full h-full flex flex-col p-16">
      <div class="w-full flex justify-between items-start">
        <div
          class="flex items-center gap-3 opacity-80 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
        >
          <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: themeColor }" />
          <span class="text-lg font-bold tracking-widest uppercase">{{ siteName }}</span>
        </div>

        <img
          v-if="base64Logo"
          :src="base64Logo"
          width="120"
          height="120"
          style="width: 120px; height: 120px; object-fit: contain"
        />
        <div
          v-else
          class="h-[100px] w-[100px] rounded-lg bg-white/10 flex items-center justify-center text-4xl font-bold backdrop-blur-sm border border-white/10"
        >
          {{ siteName[0] }}
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-4xl mt-auto mb-20">
        <h1 class="text-7xl font-black leading-tight text-white drop-shadow-xl tracking-tight">
          {{ title }}
        </h1>
        <p v-if="description" class="text-3xl text-gray-300 line-clamp-2 leading-snug font-light">
          {{ description }}
        </p>
      </div>

      <div class="absolute bottom-16 left-16 flex items-center">
        <span class="text-xl font-medium opacity-70 tracking-wide">{{ domain }}</span>
      </div>
    </div>

    <div
      class="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 pointer-events-none mix-blend-screen"
      :style="{ backgroundColor: themeColor }"
    />
    <div
      class="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 pointer-events-none"
      :style="{ backgroundColor: themeColor }"
    />
  </div>
</template>

<script setup lang="ts">
import sharp from 'sharp'

const props = defineProps<{
  title: string
  description?: string
  siteName: string
  siteLogo?: string
  themeColor: string
  domain: string
}>()

const { data: base64Logo } = await useAsyncData(
  'fetch-logo',
  async () => {
    if (!props.siteLogo) return null

    try {
      const response = await $fetch(props.siteLogo, {
        responseType: 'arrayBuffer',
        timeout: 5000,
      })

      const inputBuffer = Buffer.from(response as ArrayBuffer)
      const pngBuffer = await sharp(inputBuffer).toFormat('png').toBuffer()
      const base64 = pngBuffer.toString('base64')

      return `data:image/png;base64,${base64}`
    } catch (e) {
      return null
    }
  },
  {
    watch: [() => props.siteLogo],
  },
)
</script>
