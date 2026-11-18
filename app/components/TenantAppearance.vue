<template>
  <div class="min-w-0 space-y-6">
    <FormClientBrandingPreview
      :name="name || $t('common.tenant.namePlaceholder')"
      :domain
      :tagline
      :currentTheme="theme"
      :accentColor
      :brandGradient
      :typographyPreset
      :plan
      logoUrl=""
      description=""
      headingFontUrl=""
      bodyFontUrl=""
    />
    <UFormField :label="$t('common.preferences.branding.brandColor')">
      <FormClientBrandColorEditor
        v-model:theme="theme"
        v-model:accentColor="accentColor"
        v-model:brandGradient="brandGradient"
        :plan
        logoUrl=""
        clientId=""
      />
    </UFormField>
    <UFormField :label="$t('common.preferences.branding.typography')">
      <FormClientBrandTypographyEditor
        v-model:preset="typographyPreset"
        :plan
        headingFontUrl=""
        bodyFontUrl=""
        clientId=""
      />
    </UFormField>
    <UFormField :label="$t('common.preferences.branding.tagline')" :hint="`${tagline.length}/80`">
      <UInput
        v-model="tagline"
        class="w-full"
        :maxlength="80"
        :placeholder="$t('common.preferences.branding.taglinePlaceholder')"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { ThemeKey } from '~~/shared/utils/tenantTheme'
import type { BrandGradient } from '~~/shared/utils/publicationBranding'
import type { PublicationTypography } from '~~/generated/zenstack/models'

defineProps<{ name: string; domain: string; plan: string }>()
const theme = defineModel<ThemeKey>('theme', { required: true })
const accentColor = defineModel<string>('accentColor', { required: true })
const brandGradient = defineModel<BrandGradient | null>('brandGradient', { required: true })
const typographyPreset = defineModel<PublicationTypography>('typographyPreset', { required: true })
const tagline = defineModel<string>('tagline', { required: true })
</script>
