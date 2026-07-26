<template>
  <main
    class="relative isolate flex min-h-[calc(100vh-14rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 sm:py-24"
  >
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
      <div
        class="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-400/25 via-indigo-400/10 to-transparent blur-3xl dark:from-blue-500/20 dark:via-indigo-500/10"
      />
      <div
        class="absolute inset-0 bg-[radial-gradient(#0f172a0d_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)] dark:bg-[radial-gradient(#ffffff12_1px,transparent_1px)]"
      />
    </div>

    <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
      <NuxtImg
        v-if="site?.logoUrl"
        :src="site.logoUrl"
        class="h-16 w-16 rounded-2xl border border-gray-200 object-contain dark:border-gray-700"
        :alt="$t('common.avatar.alt.company')"
        width="64"
        height="64"
      />
      <div
        v-else
        aria-hidden="true"
        class="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white/70 text-2xl font-black tracking-tight text-gray-400 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-500"
      >
        {{ monogram }}
      </div>

      <ArticleEmptyOwner v-if="isOwner" :site="site" />
      <ArticleEmptyVisitor v-else :site="site" />
    </div>
  </main>
</template>

<script setup lang="ts">
import type { EmptySiteInfo } from '~~/shared/utils/emptySite'

const { site, isOwner = false } = defineProps<{
  site?: EmptySiteInfo | null
  isOwner?: boolean
}>()

const monogram = computed(() => site?.name?.trim().charAt(0).toUpperCase() || '?')
</script>
