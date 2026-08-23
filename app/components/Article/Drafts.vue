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

        <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <UCard v-for="n in 8" :key="n">
            <USkeleton class="h-40 w-full" />
            <div class="mt-3 space-y-3">
              <USkeleton class="h-4 w-3/4" />
              <USkeleton class="h-3 w-1/2" />
            </div>
          </UCard>
        </div>

        <div
          v-else-if="filteredDrafts.length"
          class="grid max-h-[36rem] grid-cols-1 gap-6 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <UPageCard v-for="draft in filteredDrafts" :key="draft.id" class="relative">
            <div class="aspect-video overflow-hidden">
              <AppMedia
                :src="draft.imageUrl"
                :alt="draft.title || $t('articles.articleCard.imageAlt')"
                aspectRatio="16 / 9"
                sizes="100vw sm:50vw lg:25vw"
                containerClass="size-full rounded-lg"
              />
            </div>
            <div class="flex flex-1 flex-col gap-3">
              <h3 class="break-words text-base font-medium tracking-tight text-highlighted">
                {{ draft.title || $t('articles.editor.drafts.untitled', [draft.id.slice(-4)]) }}
              </h3>
              <p v-if="draft.excerpt" class="line-clamp-2 flex-1 text-sm leading-snug text-muted">
                {{ draft.excerpt }}
              </p>
              <USeparator />
              <div class="flex items-center justify-between text-xs text-muted">
                <div class="flex items-center gap-1.5">
                  <UIcon size="14" name="i-mdi-clock-outline" />{{
                    format(draft.createdAt, dateFormat, { locale: dateLocale })
                  }}
                </div>
                <UTooltip :text="$t('common.actions.delete')">
                  <UButton
                    color="error"
                    variant="ghost"
                    size="sm"
                    square
                    icon="i-mdi-delete"
                    class="relative z-10"
                    :aria-label="$t('common.actions.delete')"
                    @click.stop="deleteDraft(draft.id)"
                  />
                </UTooltip>
              </div>
            </div>
            <UButton
              color="neutral"
              variant="link"
              class="absolute inset-0"
              :aria-label="draft.title || $t('articles.editor.drafts.untitled', [draft.id.slice(-4)])"
              @click="selectDraft(draft)"
            />
          </UPageCard>
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
