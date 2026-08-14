<template>
  <div
    id="articles"
    class="relative isolate flex min-h-[calc(100vh-14rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 sm:py-24"
  >
    <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
      <AppMedia
        :src="site?.logoUrl"
        :alt="$t('common.avatar.alt.company')"
        aspectRatio="1 / 1"
        fit="contain"
        sizes="64px"
        containerClass="size-16 rounded-lg"
      />

      <ArticleEmptyOwner v-if="isOwner" :site="site" />
      <ArticleEmptyVisitor v-else :site="site" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmptySiteInfo } from '~~/shared/utils/emptySite'

const { site, isOwner = false } = defineProps<{
  site?: EmptySiteInfo | null
  isOwner?: boolean
}>()
</script>
