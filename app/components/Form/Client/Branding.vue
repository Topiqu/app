<template>
  <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_28rem]">
    <div class="flex min-w-0 flex-col gap-8">
      <h2 data-branding-section="identity" class="text-lg font-semibold text-highlighted">
        {{ $t('common.preferences.branding.identity') }}
      </h2>
      <UFormField
        :label="$t('common.preferences.companyLogo.label')"
        :description="$t('common.preferences.companyLogo.description')"
      >
        <FormClientLogoUploader
          :imageUrl="logoUrl"
          @upload="emit('update:logoUrl', { url: $event.url, optimizedUrl: $event.optimizedUrl })"
        />
      </UFormField>

      <UFormField
        :label="$t('common.preferences.branding.favicon')"
        :description="$t('common.preferences.branding.faviconHelp')"
      >
        <FormClientLogoUploader
          :imageUrl="faviconUrl"
          assetType="favicon"
          @upload="emit('update:faviconUrl', $event)"
        />
      </UFormField>

      <UFormField :label="$t('common.preferences.branding.tagline')" :hint="`${localTagline.length}/80`">
        <UInput
          v-model="localTagline"
          :maxlength="80"
          :placeholder="$t('common.preferences.branding.taglinePlaceholder')"
        />
      </UFormField>

      <UFormField :label="$t('common.preferences.companyDescription.label')" :hint="`${localDescription.length}/255`">
        <UTextarea
          v-model="localDescription"
          :placeholder="$t('common.preferences.companyDescription.placeholder')"
          :maxLength="255"
          autoresize
        />
      </UFormField>

      <h2 data-branding-section="visual-style" class="text-lg font-semibold text-highlighted">
        {{ $t('common.preferences.branding.visualStyle') }}
      </h2>
      <UFormField :label="$t('common.preferences.theme.label')">
        <UPopover :content="{ align: 'start' }">
          <UButton
            color="neutral"
            variant="outline"
            trailingIcon="mdi:chevron-down"
            :label="localTheme"
            :style="{ borderInlineStart: `2rem solid ${currentThemeColor}` }"
          />
          <template #content>
            <div class="grid grid-cols-5 gap-2 p-3" :aria-label="$t('common.preferences.theme.label')">
              <UButton
                v-for="theme in themes"
                :key="theme"
                square
                color="neutral"
                :variant="localTheme === theme ? 'outline' : 'ghost'"
                :style="{ backgroundColor: themeColors[theme] }"
                :aria-label="theme"
                :title="theme"
                @click="localTheme = theme"
              />
            </div>
          </template>
        </UPopover>
      </UFormField>

      <UFormField :label="$t('common.preferences.branding.typography')">
        <div class="grid gap-3 sm:grid-cols-3">
          <div
            v-for="preset in typographyPresets"
            :key="preset.value"
            class="rounded-(--topiqu-surface-radius) border"
            :class="typographyPreset === preset.value ? 'border-primary bg-primary/5' : 'border-default bg-default'"
            :style="{ fontFamily: preset.font }"
          >
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              block
              :aria-label="preset.label"
              :aria-pressed="typographyPreset === preset.value"
              @click="emit('update:typographyPreset', preset.value)"
            >
              <span
                ><strong class="block">{{ preset.label }}</strong
                ><span class="text-xs text-muted">Aa Bb Cc</span></span
              >
            </UButton>
          </div>
        </div>
      </UFormField>

      <div class="lg:hidden">
        <FormClientBrandingPreview
          :logoUrl="logoUrl"
          :name="name"
          :tagline="localTagline"
          :description="localDescription"
          :currentTheme="localTheme"
          :typographyPreset="typographyPreset"
        />
      </div>

      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between">
          <span data-branding-section="socials" class="text-lg font-semibold text-highlighted">
            {{ $t('common.preferences.socials.label') }}
          </span>
          <UDropdownMenu :items="availableSocialItems">
            <UButton
              color="neutral"
              variant="soft"
              icon="mdi:plus"
              :label="$t('common.preferences.branding.addSocial')"
            />
          </UDropdownMenu>
        </div>

        <div v-if="localSocials.length" class="grid gap-4">
          <UCard v-for="(social, index) in localSocials" :key="index">
            <div class="flex items-center gap-3 border-b border-default p-4">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                :style="{ backgroundColor: platformColors[social.platform] }"
              >
                <UIcon size="20" :name="platformIcons[social.platform]" class="text-white" />
              </div>
              <span class="text-sm font-medium text-highlighted">{{ social.platform }}</span>
              <UBadge v-if="!isValidUrl(social.url)" color="error" variant="soft">{{
                $t('common.messages.invalidUrlShort')
              }}</UBadge>
              <UButton
                color="neutral"
                variant="ghost"
                square
                icon="mdi:trash-can-outline"
                class="ml-auto"
                :aria-label="$t('common.actions.delete')"
                @click="removeSocial(index)"
              />
            </div>
            <div class="p-4">
              <UFormField :label="social.platform" :ui="{ label: 'sr-only' }">
                <UInput
                  v-model="localSocials[index]!.url"
                  :placeholder="platformPlaceholders[social.platform]"
                  :maxLength="255"
                  :leadingIcon="platformIcons[social.platform]"
                  @blur="normalizeUrl(index)"
                />
              </UFormField>
            </div>
          </UCard>
        </div>

        <UEmpty v-else size="sm" :description="$t('common.preferences.socials.noSocials')" />
      </div>
    </div>

    <aside data-publication-preview class="sticky top-24 hidden lg:block">
      <FormClientBrandingPreview
        :logoUrl="logoUrl"
        :name="name"
        :tagline="localTagline"
        :description="localDescription"
        :currentTheme="localTheme"
        :typographyPreset="typographyPreset"
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '@prisma/client'

import { ThemeSchema } from '~~/shared/zod/enums'

import { type ThemeKey, themeColors } from '~/composables/theme'

const { logoUrl, description, tagline, faviconUrl, typographyPreset, socials, name, domain, currentTheme } =
  defineProps<{
    logoUrl: string
    description: string
    tagline: string
    faviconUrl: string
    typographyPreset: 'MODERN' | 'EDITORIAL' | 'SYSTEM'
    socials: { platform: SocialPlatform; url: string }[]
    name: string
    domain: string
    currentTheme: string
  }>()

const emit = defineEmits<{
  'update:logoUrl': [url: { url: string; optimizedUrl: string }]
  'update:description': [value: string]
  'update:tagline': [value: string]
  'update:faviconUrl': [url: { url: string; optimizedUrl: string }]
  'update:typographyPreset': [preset: 'MODERN' | 'EDITORIAL' | 'SYSTEM']
  'update:socials': [socials: { platform: SocialPlatform; url: string }[]]
  'update:currentTheme': [theme: string]
}>()

const themes = ThemeSchema.options

const localDescription = computed({
  get: () => description,
  set: (value) => emit('update:description', value),
})
const localTagline = computed({
  get: () => tagline,
  set: (value) => emit('update:tagline', value),
})
const typographyPresets = computed(() => [
  {
    value: 'MODERN' as const,
    label: $t('common.preferences.branding.modern'),
    font: '"Manrope Variable", sans-serif',
  },
  {
    value: 'EDITORIAL' as const,
    label: $t('common.preferences.branding.editorial'),
    font: '"Source Serif 4 Variable", serif',
  },
  {
    value: 'SYSTEM' as const,
    label: $t('common.preferences.branding.system'),
    font: 'system-ui, sans-serif',
  },
])
const localTheme = computed({
  get: () => currentTheme,
  set: (value: string) => emit('update:currentTheme', value),
})
const currentThemeColor = computed(() => themeColors[localTheme.value as ThemeKey] || themeColors.indigo)

const localSocials = computed({
  get: () => socials,
  set: (value) => emit('update:socials', value),
})

const socialPlatforms: SocialPlatform[] = ['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'OTHER']
const availableSocialItems = computed(() =>
  socialPlatforms
    .filter((platform) => !localSocials.value.some((social) => social.platform === platform))
    .map((platform) => ({
      label: platform,
      icon: platformIcons[platform],
      onSelect: () => addSocial(platform),
    })),
)

const platformIcons: Record<SocialPlatform, string> = {
  FACEBOOK: 'mdi:facebook',
  TWITTER: 'mdi:alpha-x-circle',
  INSTAGRAM: 'mdi:instagram',
  LINKEDIN: 'mdi:linkedin',
  YOUTUBE: 'mdi:youtube',
  OTHER: 'mdi:web',
}

const platformColors: Record<SocialPlatform, string> = {
  FACEBOOK: '#1877F2',
  TWITTER: '#09090B',
  INSTAGRAM: '#E1306C',
  LINKEDIN: '#0A66C2',
  YOUTUBE: '#FF0000',
  OTHER: '#4B5563',
}

const platformPlaceholders = computed(() => ({
  FACEBOOK: `https://facebook.com/${name ?? ''}`,
  TWITTER: `https://x.com/${name ?? ''}`,
  INSTAGRAM: `https://instagram.com/${name ?? ''}`,
  LINKEDIN: `https://linkedin.com/company/${name ?? ''}`,
  YOUTUBE: `https://youtube.com/@${name ?? ''}`,
  OTHER: `https://${domain ?? ''}.cz`,
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
