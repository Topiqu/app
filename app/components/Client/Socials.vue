<template>
  <div
    v-if="socials.length"
    class="flex flex-wrap items-center gap-1.5"
    role="group"
    :aria-label="$t('common.preferences.socials.label')"
  >
    <UButton
      v-for="social in socials"
      :key="social.platform"
      :to="social.url"
      target="_blank"
      rel="noopener noreferrer"
      color="neutral"
      variant="soft"
      size="sm"
      :data-platform="social.platform"
      :icon="platformIcons[social.platform] || platformIcons.OTHER"
      :square="social.platform !== 'OTHER'"
      :label="social.platform === 'OTHER' ? $t('common.preferences.socials.platforms.OTHER') : undefined"
      :title="$t(`common.preferences.socials.platforms.${social.platform}`)"
      :aria-label="$t(`common.preferences.socials.platforms.${social.platform}`)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '~~/generated/zenstack/models'

const { socials } = defineProps<{ socials: PublicClientSite['socials'] }>()

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'mdi:facebook',
  TWITTER: 'mdi:alpha-x-circle',
  INSTAGRAM: 'mdi:instagram',
  LINKEDIN: 'mdi:linkedin',
  YOUTUBE: 'mdi:youtube',
  OTHER: 'mdi:web',
}
</script>
