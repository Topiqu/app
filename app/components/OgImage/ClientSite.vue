<template>
  <div class="w-full h-full flex flex-col justify-between text-white relative overflow-hidden bg-[#0f172a]">
    <div
      style="
        position: absolute;
        bottom: 0;
        left: 0;
        background: green;
        color: white;
        padding: 10px;
        font-size: 20px;
        z-index: 9999;
        width: 100%;
        font-weight: bold;
      "
    >
      SUCCESS: {{ base64Logo ? 'PNG Generated (' + base64Logo.length + ' chars)' : 'Converting...' }}
    </div>

    <div
      class="absolute inset-0 w-full h-full opacity-40"
      :style="{ background: `linear-gradient(135deg, ${themeColor} 0%, #0f172a 100%)` }"
    />
    <div class="absolute inset-0 bg-black/20" />

    <div class="relative z-10 w-full h-full flex flex-col justify-between p-16">
      <div class="flex items-center gap-4">
        <img
          v-if="base64Logo"
          :src="base64Logo"
          width="120"
          height="120"
          style="width: 120px; height: 120px; object-fit: contain; border-radius: 6px"
        />
        <div
          v-else
          class="h-[120px] w-[120px] rounded bg-white/10 flex items-center justify-center text-4xl font-bold backdrop-blur-sm border border-white/10"
        >
          {{ siteName[0] }}
        </div>
        <span class="text-3xl font-semibold opacity-90 tracking-wide">{{ siteName }}</span>
      </div>

      <div class="flex flex-col gap-6 max-w-5xl">
        <h1 class="text-8xl font-black leading-[1.05] text-white drop-shadow-xl tracking-tight">
          {{ title }}
        </h1>
        <p v-if="description" class="text-4xl text-gray-200 line-clamp-3 leading-snug opacity-90 font-light max-w-4xl">
          {{ description }}
        </p>
      </div>

      <div class="flex items-center mt-4">
        <div class="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: themeColor }" />
          <span class="text-2xl font-medium opacity-80 tracking-wide">{{ domain }}</span>
        </div>
      </div>
    </div>

    <div
      class="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[120px] opacity-40 pointer-events-none mix-blend-screen"
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

      const webpBuffer = Buffer.from(response as ArrayBuffer)

      const pngBuffer = await sharp(webpBuffer).toFormat('png').toBuffer()

      const base64 = pngBuffer.toString('base64')
      return `data:image/png;base64,${base64}`
    } catch (e) {
      console.error('OG CONVERSION ERROR:', e)
      return null
    }
  },
  {
    watch: [() => props.siteLogo],
  },
)
</script>
