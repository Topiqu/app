<template>
  <div class="w-full h-full flex flex-col justify-center items-center text-white bg-[#0f172a] relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-900/40" />

    <div class="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/30 rounded-full blur-[100px]" />
    <div class="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-[100px]" />

    <div class="relative z-10 flex flex-col items-center gap-6 p-12 text-center">
      <img
        v-if="base64AppLogo"
        :src="base64AppLogo"
        width="120"
        height="120"
        class="mb-4"
        style="width: 120px; height: 120px; object-fit: contain"
      />
      <div v-else class="mb-4 w-[120px] h-[120px] bg-white/10 rounded-full animate-pulse" />

      <h1 class="text-7xl font-black tracking-tight text-white drop-shadow-xl">
        {{ title }}
      </h1>

      <p class="text-3xl text-blue-200 font-light max-w-3xl leading-relaxed">
        {{ description }}
      </p>
    </div>

    <div class="absolute bottom-10 flex items-center gap-2 opacity-60">
      <div class="w-2 h-2 rounded-full bg-blue-400" />
      <span class="text-xl font-medium tracking-widest uppercase">Topiqu.com</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import sharp from 'sharp'

defineProps<{
  title?: string
  description?: string
}>()

const APP_LOGO_URL = 'https://cdn.topiqu.com/app-logo.png'

const { data: base64AppLogo } = await useAsyncData('default-card-logo', async () => {
  try {
    const response = await $fetch(APP_LOGO_URL, {
      responseType: 'arrayBuffer',
      timeout: 5000,
    })

    const inputBuffer = Buffer.from(response as ArrayBuffer)
    const pngBuffer = await sharp(inputBuffer).toFormat('png').toBuffer()

    return `data:image/png;base64,${pngBuffer.toString('base64')}`
  } catch (e) {
    console.error('Failed to load default app logo', e)
    return null
  }
})
</script>
