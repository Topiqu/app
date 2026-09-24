<template>
  <div class="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
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
      <section class="min-w-0 space-y-5 rounded-(--topiqu-surface-radius) border border-default p-4 sm:p-5" aria-labelledby="brand-color-heading">
        <h3 id="brand-color-heading" class="text-base font-semibold text-highlighted">
          {{ $t('common.preferences.branding.brandColor') }}
        </h3>
        <FormClientBrandColorEditor
          :theme="currentTheme"
          :accentColor
          :brandGradient
          :logoUrl
          :clientId
          :plan
          @update:theme="emit('update:currentTheme', $event)"
          @update:accentColor="emit('update:accentColor', $event)"
          @update:brandGradient="emit('update:brandGradient', $event)"
        />
      </section>

      <section class="min-w-0 space-y-5 rounded-(--topiqu-surface-radius) border border-default p-4 sm:p-5" aria-labelledby="brand-typography-heading">
        <h3 id="brand-typography-heading" class="text-base font-semibold text-highlighted">
          {{ $t('common.preferences.branding.typography') }}
        </h3>
        <FormClientBrandTypographyEditor
          :preset="typographyPreset"
          :headingFontUrl
          :bodyFontUrl
          :clientId
          :plan
          @update:preset="emit('update:typographyPreset', $event)"
          @update:headingFontUrl="emit('update:headingFontUrl', $event)"
          @update:bodyFontUrl="emit('update:bodyFontUrl', $event)"
        />
      </section>

      <div class="xl:hidden">
        <FormClientBrandingPreview
          :logoUrl
          :name
          :tagline="localTagline"
          :description="localDescription"
          :currentTheme
          :typographyPreset
          :accentColor
          :brandGradient
          :headingFontUrl
          :bodyFontUrl
          :plan
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

    <aside data-publication-preview class="sticky top-24 hidden xl:block">
      <FormClientBrandingPreview
        :logoUrl
        :name
        :tagline="localTagline"
        :description="localDescription"
        :currentTheme
        :typographyPreset
        :accentColor
        :brandGradient
        :headingFontUrl
        :bodyFontUrl
        :plan
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { SocialPlatform } from '~~/generated/zenstack/models'
import type { BrandGradient } from '~~/shared/utils/publicationBranding'

import type { PublicationTypography, ThemeKey } from '~/composables/theme'

const {
  logoUrl,
  description,
  tagline,
  faviconUrl,
  typographyPreset,
  socials,
  name,
  domain,
  currentTheme,
  accentColor,
  brandGradient,
  headingFontUrl,
  bodyFontUrl,
  clientId,
  plan,
} = defineProps<{
  logoUrl: string
  description: string
  tagline: string
  faviconUrl: string
  typographyPreset: PublicationTypography
  accentColor: string
  brandGradient: BrandGradient | null
  headingFontUrl: string
  bodyFontUrl: string
  clientId: string
  plan: string
  socials: { platform: SocialPlatform; url: string }[]
  name: string
  domain: string
  currentTheme: ThemeKey
}>()

const emit = defineEmits<{
  'update:logoUrl': [url: { url: string; optimizedUrl: string }]
  'update:description': [value: string]
  'update:tagline': [value: string]
  'update:faviconUrl': [url: { url: string; optimizedUrl: string }]
  'update:typographyPreset': [preset: PublicationTypography]
  'update:accentColor': [color: string]
  'update:brandGradient': [gradient: BrandGradient | null]
  'update:headingFontUrl': [url: string]
  'update:bodyFontUrl': [url: string]
  'update:socials': [socials: { platform: SocialPlatform; url: string }[]]
  'update:currentTheme': [theme: ThemeKey]
}>()

const localDescription = computed({
  get: () => description,
  set: (value) => emit('update:description', value),
})
const localTagline = computed({
  get: () => tagline,
  set: (value) => emit('update:tagline', value),
})

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
