<template>
  <UProgress v-if="pending" class="w-24" />
  <div v-else-if="client?.socials?.length" class="flex gap-3 py-4">
    <UButton
      v-for="social in client.socials"
      :key="social.platform"
      :to="social.url"
      target="_blank"
      color="neutral"
      variant="ghost"
      class="social-platform-button"
      :data-platform="social.platform"
      :icon="platformIcons[social.platform] || platformIcons.OTHER"
      square
      :title="social.platform.charAt(0).toUpperCase() + social.platform.slice(1).toLowerCase()"
      :aria-label="social.platform.toLowerCase()"
    />
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '@prisma/client'

const props = defineProps<{ clientSiteId: string }>()

interface ClientSite {
  socials: { platform: SocialPlatform; url: string }[]
}

const { data: client, pending } = await useFetch<ClientSite>(() => `/api/clients/${props.clientSiteId}/public`, {
  key: `socials-${props.clientSiteId}`,
  default: () => ({ socials: [] }),
})

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'i-mdi-facebook',
  TWITTER: 'i-mdi-alpha-x-circle',
  INSTAGRAM: 'i-mdi-instagram',
  LINKEDIN: 'i-mdi-linkedin',
  YOUTUBE: 'i-mdi-youtube',
  OTHER: 'i-mdi-web',
}
</script>
