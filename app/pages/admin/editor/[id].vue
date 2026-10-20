<template>
  <NuxtErrorBoundary>
    <Suspense timeout="0">
      <LazyArticleEditorWorkspace />
      <template #fallback><ArticleEditorSkeleton /></template>
    </Suspense>
    <template #error>
      <div class="mx-auto w-full max-w-7xl p-4">
        <UAlert
          color="error"
          icon="mdi:alert-circle-outline"
          :title="$t('common.messages.loadFailedTitle')"
          :description="$t('common.messages.loadFailedText')"
        >
          <template #actions>
            <UButton color="neutral" variant="soft" icon="mdi:refresh" @click="retry">
              {{ $t('common.messages.retry') }}
            </UButton>
          </template>
        </UAlert>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
const retry = () => reloadNuxtApp()
</script>
