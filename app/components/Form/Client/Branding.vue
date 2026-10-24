<template>
  <div class="min-w-0 space-y-8">
    <div class="flex min-w-0 max-w-2xl flex-col gap-6">
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
    </div>

    <div
      class="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]"
    >
      <div class="flex min-w-0 flex-col gap-6">
        <h2 data-branding-section="visual-style" class="text-lg font-semibold text-highlighted">
          {{ $t('common.preferences.branding.visualStyle') }}
        </h2>
        <section class="min-w-0 space-y-4" aria-labelledby="brand-color-heading">
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

        <section class="min-w-0 space-y-4 border-t border-default pt-6" aria-labelledby="brand-typography-heading">
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

        <section
          class="@container min-w-0 space-y-4 rounded-(--topiqu-surface-radius) border border-default p-4 sm:p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span data-branding-section="socials" class="text-lg font-semibold text-highlighted">
              {{ $t('common.preferences.socials.label') }}
            </span>
            <UDropdownMenu :items="availableSocialItems">
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="mdi:plus"
                :label="$t('common.preferences.branding.addSocial')"
              />
            </UDropdownMenu>
          </div>

          <div v-if="localSocials.length" class="divide-y divide-default">
            <div
              v-for="(social, index) in localSocials"
              :key="social.platform"
              class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 first:pt-0 last:pb-0 @sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
            >
              <div class="col-span-2 flex min-w-0 items-center gap-2 @sm:col-span-1">
                <UIcon size="18" :name="platformIcons[social.platform]" class="shrink-0 text-muted" />
                <span class="text-sm font-medium text-highlighted">{{
                  $t(`common.preferences.socials.platforms.${social.platform}`)
                }}</span>
              </div>
              <UFormField
                :label="$t(`common.preferences.socials.platforms.${social.platform}`)"
                :ui="{ wrapper: 'sr-only', container: 'mt-0' }"
                :error="!isValidUrl(social.url) ? $t('common.messages.invalidUrlShort') : undefined"
                class="min-w-0"
              >
                <UInput
                  v-model="localSocials[index]!.url"
                  :placeholder="platformPlaceholders[social.platform]"
                  :maxLength="255"
                  class="w-full"
                  @blur="normalizeUrl(index)"
                />
              </UFormField>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                square
                icon="mdi:trash-can-outline"
                :aria-label="`${$t('common.actions.delete')}: ${$t(`common.preferences.socials.platforms.${social.platform}`)}`"
                @click="removeSocial(index)"
              />
            </div>
          </div>

          <UEmpty v-else size="sm" :description="$t('common.preferences.socials.noSocials')" />
        </section>
        <slot name="after" />
      </div>
      <aside class="order-first min-w-0 xl:order-last xl:sticky xl:top-6">
        <FormClientBrandingPreview
          :logoUrl
          :name
          :domain
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
  </div>
</template>

<script setup lang="ts">
import type { ThemeKey } from '~~/shared/utils/tenantTheme'
import type { BrandGradient } from '~~/shared/utils/publicationBranding'
import type { PublicationTypography, SocialPlatform } from '~~/generated/zenstack/models'

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
      label: $t(`common.preferences.socials.platforms.${platform}`),
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

const platformPlaceholders = computed(() => ({
  FACEBOOK: `https://facebook.com/${name ?? ''}`,
  TWITTER: `https://x.com/${name ?? ''}`,
  INSTAGRAM: `https://instagram.com/${name ?? ''}`,
  LINKEDIN: `https://linkedin.com/company/${name ?? ''}`,
  YOUTUBE: `https://youtube.com/@${name ?? ''}`,
  OTHER: `https://${domain ?? ''}`,
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
