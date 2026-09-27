<template>
  <div
    id="articles"
    class="relative isolate flex min-h-[calc(100vh-14rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 sm:py-24"
  >
    <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
      <UAlert
        v-if="previewing"
        color="neutral"
        variant="subtle"
        icon="mdi:eye-outline"
        :title="$t('articles.empty.owner.previewing')"
        class="text-left"
      >
        <template #actions>
          <UButton :to="{ query: {} }" size="sm" color="neutral" variant="outline">
            {{ $t('articles.empty.owner.previewBack') }}
          </UButton>
        </template>
      </UAlert>

      <AppMedia
        :src="site?.logoUrl"
        :alt="$t('common.avatar.alt.company')"
        aspectRatio="1 / 1"
        fit="contain"
        sizes="64px"
        containerClass="size-16 rounded-lg"
      />

      <ArticleEmptyOwner v-if="isOwner && !previewing" :site="site" />
      <ArticleEmptyVisitor v-else :site="site" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SiteSetupInfo } from '~~/shared/utils/siteSetup'

const { site, isOwner = false } = defineProps<{
  site?: SiteSetupInfo | null
  isOwner?: boolean
}>()

const route = useRoute()
const previewing = computed(() => isOwner && route.query.preview === 'visitor')
</script>
