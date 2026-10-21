<template>
  <div
    class="w-full h-full flex flex-col justify-center items-center text-white bg-[#0f172a] relative overflow-hidden"
    style="font-family: Inter"
  >
    <div
      class="absolute inset-0"
      style="background-image: linear-gradient(to bottom right, rgba(37, 99, 235, 0.2), rgba(88, 28, 135, 0.4))"
    />

    <div
      class="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/30 rounded-full"
      style="filter: blur(100px)"
    />
    <div
      class="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/30 rounded-full"
      style="filter: blur(100px)"
    />

    <div class="relative flex flex-col items-center gap-6 p-12 text-center">
      <img
        :src="appLogo"
        width="120"
        height="120"
        class="mb-4"
        style="width: 120px; height: 120px; object-fit: contain"
      />

      <h1
        class="text-7xl font-black tracking-tight text-white"
        style="filter: drop-shadow(0 9px 7px rgba(0, 0, 0, 0.1))"
      >
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
defineProps<{
  title?: string
  description?: string
}>()

const appLogo = 'https://cdn.topiqu.com/app-logo.png'
</script>
