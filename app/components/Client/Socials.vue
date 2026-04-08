<template>
  <div v-if="pending" class="flex justify-center items-center py-4">
    <Icon name="mdi:loading" class="w-6 h-6 text-blue-600 animate-spin" />
  </div>
  <div v-else-if="client?.socials?.length" class="flex gap-3 py-4">
    <NuxtLink
      v-for="social in client.socials"
      :key="social.platform"
      :to="social.url"
      target="_blank"
      class="flex items-center justify-center w-10 h-10 rounded-lg transition-transform duration-200 hover:scale-110"
      :class="platformStyles[social.platform].bg"
      :title="social.platform.toLowerCase()"
      :aria-label="social.platform.toLowerCase()"
    >
      <Icon :name="platformIcons[social.platform]" class="w-6 h-6 text-white" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '@prisma/client'

const props = defineProps<{ clientSiteId: string }>()

interface ClientSite {
  socials: { platform: SocialPlatform; url: string }[]
}

const { data: client, pending } = await useFetch<ClientSite>(`/api/clients/${props.clientSiteId}/public`, {
  default: () => ({ socials: [] }),
})

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'mdi:facebook',
  TWITTER: 'mdi:alpha-x-circle',
  INSTAGRAM: 'mdi:instagram',
  LINKEDIN: 'mdi:linkedin',
  YOUTUBE: 'mdi:youtube',
  OTHER: 'mdi:web',
}

const platformStyles: Record<SocialPlatform, { bg: string }> = {
  FACEBOOK: { bg: 'bg-blue-600 hover:bg-blue-700' },
  TWITTER: { bg: 'bg-black hover:bg-gray-800' },
  INSTAGRAM: { bg: 'bg-pink-500 hover:bg-pink-600' },
  LINKEDIN: { bg: 'bg-blue-800 hover:bg-blue-900' },
  YOUTUBE: { bg: 'bg-red-600 hover:bg-red-700' },
  OTHER: { bg: 'bg-gray-600 hover:bg-gray-700' },
}
</script>
