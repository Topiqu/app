<template>
  <div class="text-center py-12 space-y-4">
    <div
      class="mx-auto w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500"
      aria-hidden="true"
    >
      <Icon :name="isOwner ? 'mdi:file-document-edit-outline' : 'mdi:clock-outline'" class="w-7 h-7" />
    </div>

    <p class="text-xl font-semibold text-gray-700 dark:text-gray-200">
      {{ isOwner ? $t('articles.empty.owner.title') : $t('articles.empty.title') }}
    </p>
    <p class="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-balance">
      {{ isOwner ? $t('articles.empty.owner.message') : $t('articles.empty.message') }}
    </p>

    <div v-if="isOwner" class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
      <NuxtLink
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' } })"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium no-underline transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
      >
        <Icon name="material-symbols:edit-square-outline-rounded" class="w-5 h-5" aria-hidden="true" />
        {{ $t('articles.empty.owner.writeCta') }}
      </NuxtLink>
      <NuxtLink
        :to="localePath({ name: 'admin' })"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 font-medium no-underline transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
      >
        {{ $t('articles.empty.owner.adminCta') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ isOwner?: boolean }>()

const localePath = useLocalePath()
</script>
