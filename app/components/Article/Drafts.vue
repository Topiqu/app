<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('articles.editor.drafts.selectDraftTitle')"
    :dismissible="!loading"
    :ui="{ content: 'max-w-[50rem]' }"
    @close:prevent="close"
  >
    <template #body>
      <div class="mt-4">
        <div v-if="drafts.length" class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <UFormField :label="$t('common.search')" :ui="{ label: 'sr-only' }" class="w-full flex-1">
            <UInput
              v-model="searchQuery"
              :placeholder="$t('common.search')"
              :disabled="loading"
              icon="i-mdi-magnify"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="$t('articles.editor.drafts.selectDraftTitle')"
            :ui="{ label: 'sr-only' }"
            class="w-full md:w-40"
          >
            <USelectMenu
              v-model="sortOption"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="sortItems"
              class="w-full"
              :disabled="loading"
            />
          </UFormField>
        </div>

        <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UCard v-for="n in 4" :key="n">
            <USkeleton class="h-40 w-full" />
            <div class="mt-3 space-y-3">
              <USkeleton class="h-4 w-3/4" />
              <USkeleton class="h-3 w-1/2" />
            </div>
          </UCard>
        </div>

        <div
          v-else-if="filteredDrafts.length"
          class="grid max-h-[min(36rem,65dvh)] grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto p-0.5 pr-2 sm:grid-cols-2"
        >
          <article
            v-for="draft in filteredDrafts"
            :key="draft.id"
            class="group relative min-w-0 overflow-hidden rounded-xl border border-default bg-default transition hover:border-primary/50 hover:shadow-md focus-within:ring-2 focus-within:ring-primary"
          >
            <button type="button" class="block size-full min-w-0 text-left" @click="selectDraft(draft)">
              <AppMedia
                :src="draft.imageUrl"
                :alt="draft.title || $t('articles.articleCard.imageAlt')"
                aspectRatio="16 / 9"
                sizes="100vw sm:400px"
                containerClass="w-full rounded-none"
              />
              <div class="min-w-0 space-y-2 p-4 pr-12">
                <h3 class="line-clamp-2 text-base font-semibold tracking-tight text-highlighted">
                  {{ draft.title || $t('articles.editor.drafts.untitled', [draft.id.slice(-4)]) }}
                </h3>
                <p v-if="draft.excerpt" class="line-clamp-2 text-sm leading-snug text-muted">
                  {{ draft.excerpt }}
                </p>
                <div class="flex min-w-0 items-center gap-1.5 border-t border-default pt-2 text-xs text-muted">
                  <UIcon class="shrink-0" size="14" name="i-mdi-clock-outline" />
                  <span class="truncate">{{ format(draft.createdAt, dateFormat, { locale: dateLocale }) }}</span>
                </div>
              </div>
            </button>
            <UTooltip :text="$t('common.actions.delete')">
              <UButton
                color="error"
                variant="soft"
                size="sm"
                square
                icon="i-mdi-delete"
                class="absolute right-3 bottom-3 z-10"
                :aria-label="$t('common.actions.delete')"
                @click.stop="deleteDraft(draft.id)"
              />
            </UTooltip>
          </article>
        </div>

        <UEmpty v-else icon="i-mdi-file-search-outline" :title="$t('common.noResults')" />
      </div>
    </template>
  </UModal>
</template>
<script setup lang="ts">
import type { ArticleDraft } from '@zenstackhq/runtime/models'

import { format } from 'date-fns'
import { enUS, cs } from 'date-fns/locale'

const props = defineProps<{
  drafts: ArticleDraft[]
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [draft: ArticleDraft]
  close: []
}>()

const { t, locale } = useI18n()
const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const dateLocale = computed(() => (locale.value === 'en' ? enUS : cs))
const dateFormat = computed(() => (locale.value === 'en' ? 'MMM d, yyyy HH:mm' : 'd. MMMM yyyy HH:mm'))
const searchQuery = shallowRef('')
const sortOption = shallowRef<'newest' | 'oldest' | 'alphabetical'>('newest')

const sortItems = [
  { value: 'newest', label: t('common.sortOptions.newest'), icon: 'i-mdi-clock-outline' },
  { value: 'oldest', label: t('common.sortOptions.oldest'), icon: 'i-mdi-clock' },
  { value: 'alphabetical', label: 'A-Z', icon: 'i-mdi-sort-alphabetical-ascending' },
]

const localDrafts = ref<ArticleDraft[]>([...props.drafts])

watch(
  () => props.drafts,
  (newDrafts) => (localDrafts.value = [...newDrafts]),
  { deep: true },
)

const filteredDrafts = computed(() => {
  let result = [...localDrafts.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((d) => d.title?.toLowerCase().includes(q) || d.excerpt?.toLowerCase().includes(q))
  }
  if (sortOption.value === 'newest') result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  else if (sortOption.value === 'oldest') result.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  else if (sortOption.value === 'alphabetical') result.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  return result
})

const close = () => {
  isOpen.value = false
  emit('close')
}

const selectDraft = (draft: ArticleDraft) => {
  emit('select', draft)
  close()
}

const deleteDraft = async (draftId: string) => {
  try {
    await $fetch('/api/articles/draft', { method: 'DELETE', body: { id: draftId } })
    localDrafts.value = localDrafts.value.filter((d) => d.id !== draftId)
    toast.add({ color: 'success', title: t('common.messages.deleteSuccess') })
  } catch {
    toast.add({ color: 'error', title: t('common.messages.deleteFailed') })
  }
}
</script>
