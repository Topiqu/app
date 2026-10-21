<template>
  <div class="w-full h-full flex flex-col relative overflow-hidden bg-[#0f172a] text-white" style="font-family: Inter">
    <div
      class="absolute inset-0 w-full h-full opacity-40"
      :style="{ background: brandGradient ?? `linear-gradient(135deg, ${themeColor} 0%, #0f172a 100%)` }"
    />

    <div class="absolute inset-0 bg-black/20" />

    <div
      class="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full opacity-25"
      :style="{ backgroundColor: themeColor, filter: 'blur(150px)' }"
    />
    <div
      class="absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full opacity-15"
      :style="{ backgroundColor: themeColor, filter: 'blur(120px)' }"
    />

    <div class="absolute top-16 left-16 flex items-center gap-3 opacity-90">
      <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }" />
      <span class="text-xl font-bold tracking-widest uppercase opacity-80">{{ siteName }}</span>
    </div>

    <div class="absolute top-16 right-16">
      <img
        v-if="siteLogo"
        :src="siteLogo"
        width="140"
        height="140"
        style="width: 140px; height: 140px; object-fit: contain"
      />
      <div
        v-else
        class="h-[120px] w-[120px] rounded-xl bg-white/5 flex items-center justify-center text-5xl font-bold"
        style="border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)"
      >
        {{ siteName[0] }}
      </div>
    </div>

    <!-- pb clears the absolutely-positioned domain pill below (bottom-16 + its own height). -->
    <div class="relative flex flex-col justify-end h-full p-16 pb-36">
      <div class="flex flex-col gap-6 max-w-4xl">
        <h1
          class="text-8xl font-black leading-[0.95] text-white tracking-tight"
          style="filter: drop-shadow(0 25px 25px rgba(0, 0, 0, 0.15))"
        >
          {{ title }}
        </h1>
        <p
          v-if="clamped"
          class="text-4xl text-blue-100/80 leading-snug font-light max-w-5xl max-h-[100px] overflow-hidden"
        >
          {{ clamped }}
        </p>
      </div>
    </div>

    <div
      class="absolute bottom-16 left-16 flex items-center px-6 py-3 rounded-full bg-white/5"
      style="border: 1px solid rgba(255, 255, 255, 0.05)"
    >
      <span class="text-xl font-medium tracking-wide text-gray-300">{{ domain }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  siteName: string
  siteLogo?: string
  themeColor: string
  brandGradient?: string
  domain: string
}>()

// `line-clamp-2` compiles to `display: -webkit-box`, which Takumi refuses outright — it 500s the whole
// render, not just the paragraph. Cut the text instead and keep the height cap as the backstop.
const clamped = computed(() => {
  const text = props.description?.trim() ?? ''
  return text.length > 110 ? `${text.slice(0, 109).trimEnd()}…` : text
})
</script>
