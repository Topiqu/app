<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        {{ $t('common.preferences.companyLogo.label') }}
      </span>
      <FileUploader
        :imageUrl="logoUrl"
        type="client-logo"
        :maxWidth="3840"
        :maxHeight="2160"
        @upload="emit('update:logoUrl', { url: $event.url, optimizedUrl: $event.optimizedUrl })"
      />
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ $t('common.preferences.companyLogo.description') }}
      </span>
    </div>

    <FormField
      v-model="localDescription"
      :label="$t('common.preferences.companyDescription.label')"
      type="textarea"
      :placeholder="$t('common.preferences.companyDescription.placeholder')"
      :maxLength="255"
    />

    <label class="flex flex-col gap-2">
      <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        {{ $t('common.preferences.theme.label') }}
      </span>
      <div class="grid grid-cols-5 gap-6 max-w-sm justify-items-center">
        <Button
          v-for="theme in themes"
          :key="theme"
          type="button"
          :icon="currentTheme === theme ? 'mdi:check' : undefined"
          :style="{ backgroundColor: theme }"
          class="size-12! rounded-full! aspect-square"
          :class="
            currentTheme === theme
              ? 'ring-2 ring-blue-500 scale-110'
              : 'hover:scale-105 border border-gray-300 dark:border-gray-600'
          "
          @click="emit('update:currentTheme', theme)"
        />
      </div>
    </label>

    <div class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
          {{ $t('common.preferences.socials.label') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="platform in socialPlatforms"
            :key="platform"
            variant="transparent"
            :icon="platformIcons[platform]"
            :disabled="localSocials.some((s) => s.platform === platform)"
            class="text-white"
            :class="
              localSocials.some((s) => s.platform === platform)
                ? 'bg-gray-200 dark:bg-gray-700 opacity-50'
                : `${platformStyles[platform].bg}!`
            "
            @click="addSocial(platform)"
          />
        </div>
      </div>

      <div v-if="localSocials.length" class="grid gap-4">
        <div
          v-for="(social, index) in localSocials"
          :key="index"
          class="rounded-xl border bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
          :class="[
            platformStyles[social.platform].border,
            isValidUrl(social.url) ? '' : 'border-red-500 dark:border-red-400',
          ]"
        >
          <div class="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg"
              :class="platformStyles[social.platform].bg"
            >
              <Icon :name="platformIcons[social.platform]" class="w-5 h-5 text-white" />
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ social.platform }}</span>
            <button
              class="ml-auto p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              @click="removeSocial(index)"
            >
              <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
            </button>
          </div>
          <div class="p-4">
            <FormField
              v-model="localSocials[index]!.url"
              :icon="platformIcons[social.platform]"
              iconPosition="leading"
              :placeholder="platformPlaceholders[social.platform]"
              :maxLength="255"
              @blur="normalizeUrl(index)"
            />
          </div>
        </div>
      </div>

      <span v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('common.preferences.socials.noSocials') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '@prisma/client'

import { ThemeSchema } from '~~/shared/zod/enums'

const props = defineProps<{
  logoUrl: string
  description: string
  socials: { platform: SocialPlatform; url: string }[]
  name: string
  subdomain: string
  currentTheme: string
}>()

const emit = defineEmits<{
  'update:logoUrl': [url: { url: string; optimizedUrl: string }]
  'update:description': [value: string]
  'update:socials': [socials: { platform: SocialPlatform; url: string }[]]
  'update:currentTheme': [theme: string]
}>()

const themes = ThemeSchema.options

const localDescription = computed({
  get: () => props.description,
  set: (value) => emit('update:description', value),
})

const localSocials = computed({
  get: () => props.socials,
  set: (value) => emit('update:socials', value),
})

const socialPlatforms: SocialPlatform[] = ['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'OTHER']

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'mdi:facebook',
  TWITTER: 'mdi:alpha-x-circle',
  INSTAGRAM: 'mdi:instagram',
  LINKEDIN: 'mdi:linkedin',
  YOUTUBE: 'mdi:youtube',
  OTHER: 'mdi:web',
}

const platformStyles: Record<SocialPlatform, { bg: string; border: string; text: string }> = {
  FACEBOOK: {
    bg: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    border: 'border-blue-600 dark:border-blue-500',
    text: 'text-blue-600 dark:text-blue-500',
  },
  TWITTER: {
    bg: 'bg-black hover:bg-gray-800',
    border: 'border-black dark:border-gray-200',
    text: 'text-black dark:text-gray-200',
  },
  INSTAGRAM: {
    bg: 'bg-pink-500 hover:bg-pink-600 dark:bg-pink-400 dark:hover:bg-pink-500',
    border: 'border-pink-500 dark:border-pink-400',
    text: 'text-pink-500 dark:text-pink-400',
  },
  LINKEDIN: {
    bg: 'bg-blue-800 hover:bg-blue-900 dark:bg-blue-700 dark:hover:bg-blue-800',
    border: 'border-blue-800 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-700',
  },
  YOUTUBE: {
    bg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    border: 'border-red-600 dark:border-red-500',
    text: 'text-red-600 dark:text-red-500',
  },
  OTHER: {
    bg: 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600',
    border: 'border-gray-600 dark:border-gray-500',
    text: 'text-gray-600 dark:text-gray-500',
  },
}

const platformPlaceholders = computed(() => ({
  FACEBOOK: `https://facebook.com/${props.name ?? ''}`,
  TWITTER: `https://x.com/${props.name ?? ''}`,
  INSTAGRAM: `https://instagram.com/${props.name ?? ''}`,
  LINKEDIN: `https://linkedin.com/company/${props.name ?? ''}`,
  YOUTUBE: `https://youtube.com/@${props.name ?? ''}`,
  OTHER: `https://${props.subdomain ?? ''}.cz`,
}))

const addSocial = (platform: SocialPlatform) => {
  if (localSocials.value.some((s) => s.platform === platform)) return
  const newSocials = [...localSocials.value, { platform, url: platformPlaceholders.value[platform] }]
  emit('update:socials', newSocials)
}

const removeSocial = (index: number) => {
  const newSocials = localSocials.value.toSpliced(index, 1)
  emit('update:socials', newSocials)
}

const normalizeUrl = (index: number) => {
  const newSocials = [...localSocials.value]
  newSocials[index]!.url = newSocials[index]!.url.replace(/^http:\/\//, 'https://')
  emit('update:socials', newSocials)
}

const isValidUrl = (url: string) => !url.trim() || (url.startsWith('https://') && URL.canParse(url))
</script>
