<template>
  <div class="w-full h-full flex bg-[#0f172a] overflow-hidden relative">
    <img
      v-if="compatibleImage"
      :src="compatibleImage"
      width="1200"
      height="630"
      style="width: 100%; height: 100%; object-fit: cover"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  backgroundImage?: string
}>()

const img = useImage()

const compatibleImage = computed(() => {
  if (!props.backgroundImage) return undefined

  if (props.backgroundImage.startsWith('data:')) {
    return props.backgroundImage
  }

  return img(props.backgroundImage, { format: 'png', width: 1200 })
})
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
