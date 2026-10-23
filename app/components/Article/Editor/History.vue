<template>
  <UModal
    v-model:open="open"
    :title="$t('articles.editor.history.title')"
    :description="$t('articles.editor.history.description')"
  >
    <template #body>
      <p class="mb-4 text-sm text-muted">
        {{ $t('articles.editor.history.currentVersion', { version: currentVersion }) }}
      </p>
      <UProgress v-if="status === 'pending'" :aria-label="$t('common.loading')" />
      <UAlert v-else-if="error" color="error" :title="$t('articles.editor.history.loadFailed')">
        <template #actions
          ><UButton color="neutral" variant="soft" @click="refresh()">{{ $t('common.entry.retry') }}</UButton></template
        >
      </UAlert>
      <UEmpty v-else-if="!revisions?.length" icon="mdi:history" :title="$t('articles.editor.history.empty')" />
      <ul v-else class="m-0 list-none divide-y divide-default p-0">
        <li
          v-for="revision in revisions"
          :key="revision.id"
          class="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center"
        >
          <div class="min-w-0 flex-1">
            <p class="m-0 font-medium break-words text-highlighted">{{ revision.title }}</p>
            <p class="m-0 text-sm text-muted">
              {{ $t('articles.editor.history.version', { version: revision.version }) }} ·
              {{ formatDate(revision.createdAt) }}
            </p>
            <p class="m-0 text-sm text-muted">{{ revision.actorName || $t('articles.editor.history.automated') }}</p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            class="shrink-0 self-start"
            :loading="loadingId === revision.id"
            :disabled="!!loadingId"
            @click="load(revision.id)"
          >
            {{ $t('articles.editor.history.loadDraft') }}
          </UButton>
        </li>
      </ul>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ArticleRevisionSnapshot } from '~~/shared/utils/articleRevision'

import { useArticleRevisions } from '~/composables/useArticleRevisions'

const props = defineProps<{ articleId: string; currentVersion: number }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ restore: [snapshot: ArticleRevisionSnapshot] }>()
const { t, locale } = useI18n()
const toast = useToast()
const loadingId = shallowRef<string | null>(null)
const { data: revisions, status, error, refresh } = await useArticleRevisions(props.articleId)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const load = async (id: string) => {
  if (loadingId.value) return
  loadingId.value = id
  try {
    const snapshot = await $fetch<ArticleRevisionSnapshot, '/api/articles/:id/revisions/:revisionId'>(
      `/api/articles/${props.articleId}/revisions/${id}` as '/api/articles/:id/revisions/:revisionId',
    )
    emit('restore', snapshot)
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.history.loadFailed')) })
  } finally {
    loadingId.value = null
  }
}
</script>
