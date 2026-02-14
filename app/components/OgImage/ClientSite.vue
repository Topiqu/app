<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white">
    <div
      class="absolute inset-0 w-full h-full opacity-40"
      :style="{ background: `linear-gradient(135deg, ${themeColor} 0%, #0f172a 100%)` }"
    />
    <div class="absolute inset-0 bg-black/20" />

    <div class="relative z-10 w-full h-full flex flex-col justify-between p-16">
      <div class="flex justify-between items-start w-full">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 opacity-70">
            <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: themeColor }" />
            <span class="text-xl font-bold tracking-widest uppercase">{{ siteName }}</span>
          </div>
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
          class="h-[100px] w-[100px] rounded bg-white/10 flex items-center justify-center text-4xl font-bold backdrop-blur-sm border border-white/10"
        >
          {{ siteName[0] }}
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-4xl mt-auto mb-auto">
        <h1 class="text-7xl font-black leading-tight text-white drop-shadow-xl tracking-tight">
          {{ title }}
        </h1>
        <p v-if="description" class="text-3xl text-gray-300 line-clamp-2 leading-snug font-light">
          {{ description }}
        </p>
      </div>

      <div class="flex items-center mt-8">
        <div class="px-5 py-2 rounded-lg bg-white/10 border border-white/10 backdrop-blur-md">
          <span class="text-xl font-medium opacity-90 tracking-wide text-gray-200">{{ domain }}</span>
        </div>
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
    } catch {
      return null
    }
  },
  {
    watch: [() => props.siteLogo],
  },
)
</script>
