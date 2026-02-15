<template>
  <div class="w-full h-full flex flex-col justify-between text-white relative overflow-hidden bg-[#0f172a]">
    <img v-if="images.bg" :src="images.bg" class="absolute inset-0 w-full h-full object-cover opacity-60" />
    <div v-else class="absolute inset-0 w-full h-full bg-gradient-to-br from-[#5d42e8] to-[#1e40af]" />

    <div class="absolute inset-0 bg-black/40" />

    <div class="relative z-10 w-full h-full flex flex-col justify-between p-16">
      <div class="flex items-center gap-4">
        <img v-if="images.logo" :src="images.logo" class="h-12 w-auto object-contain rounded-md" />
        <div v-else class="h-12 w-12 rounded bg-white/20 flex items-center justify-center text-xl font-bold">
          {{ siteName[0] }}
        </div>
        <span class="text-2xl font-semibold opacity-90 tracking-wide">{{ siteName }}</span>

        <div
          v-if="!isPremium"
          class="ml-auto bg-[#5d42e8] px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg"
        >
          Topiqu Blog
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-4xl">
        <h1 class="text-7xl font-black leading-[1.1] text-white drop-shadow-lg">
          {{ title }}
        </h1>
        <p v-if="description" class="text-3xl text-gray-200 line-clamp-2 leading-snug opacity-90 font-light">
          {{ description }}
        </p>
      </div>

      <div class="flex items-center gap-6 mt-4">
        <div class="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <img v-if="images.author" :src="images.author" class="w-10 h-10 rounded-full border-2 border-white/50" />
          <div
            v-else
            class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 border-2 border-white/50"
          />

          <span class="text-xl font-medium">{{ authorName || 'Redaction' }}</span>
        </div>

        <div v-if="readingTime" class="flex items-center gap-2 text-xl opacity-80">
          <div class="w-1.5 h-1.5 rounded-full bg-white/50" />
          <span>{{ readingTime || 'Worth your time' }}</span>
        </div>
      </div>
    </div>

    <div
      class="absolute -top-20 -right-20 w-96 h-96 bg-[#5d42e8] rounded-full blur-[100px] opacity-50 pointer-events-none"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  siteName: string
  siteLogo?: string
  authorName?: string
  authorImage?: string
  readingTime?: string
  backgroundImage?: string
  themeColor?: string
  isPremium?: boolean
}>()
const { origin } = useRequestURL()
const getProxyUrl = (url?: string) => {
  if (!url) return undefined
  return `${origin}/api/og-proxy?url=${encodeURIComponent(url)}`
}

const images = computed(() => ({
  bg: getProxyUrl(props.backgroundImage),
  logo: getProxyUrl(props.siteLogo),
  author: getProxyUrl(props.authorImage),
}))
</script>
