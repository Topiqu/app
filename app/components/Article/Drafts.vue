<template>
  <ModalMini
    v-model:open="isOpen"
    :title="$t('articles.editor.drafts.selectDraftTitle')"
    parentWidth="max-w-6xl"
    :disabled="loading"
    @cancel="close"
  >
    <template #content>
      <div class="mt-4">
        <div class="flex items-center justify-between mb-4">
          <div v-if="drafts.length" class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-1">
            <div class="relative flex-1">
              <Icon
                name="mdi:magnify"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
              />
              <FormInput
                v-model="searchQuery"
                :placeholder="$t('common.search')"
                class="w-full py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all duration-200"
                :disabled="loading"
                icon="mdi:magnify"
              />
            </div>
            <FormSelect
              v-model="sortOption"
              :items="sortItems"
              class="w-full md:w-44"
              :disabled="loading"
              :showValue="false"
            />
          </div>
          <Button
            variant="danger"
            animation="softpop"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition ml-auto"
            @click="close"
          >
            <Icon name="mdi:close" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Button>
        </div>

        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-60">
          <div v-for="n in 8" :key="n" class="animate-pulse rounded-2xl shadow-md bg-white dark:bg-neutral-900">
            <div class="h-40 bg-gray-100 dark:bg-gray-800 rounded-t-2xl"></div>
            <div class="p-4 space-y-3">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>

        <div
          v-else-if="filteredDrafts.length"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[36rem] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
        >
          <button
            v-for="draft in filteredDrafts"
            :key="draft.id"
            class="group relative flex cursor-pointer flex-col justify-between rounded-2xl bg-white/90 dark:bg-neutral-900/70 border border-gray-200 dark:border-gray-800 overflow-hidden hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300"
            :disabled="loading"
            @click="selectDraft(draft)"
          >
            <div class="relative aspect-video overflow-hidden">
              <NuxtImg
                v-if="draft.imageUrl"
                :src="draft.imageUrl"
                class="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
              <div
                v-else
                class="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800"
              />
              <div
                class="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
            </div>

            <div class="flex flex-col p-5">
              <h3
                class="font-semibold text-gray-900 dark:text-gray-100 text-base mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              >
                {{ draft.title || $t('articles.editor.drafts.untitled') }}
              </h3>
              <p v-if="draft.excerpt" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                {{ draft.excerpt }}
              </p>

              <div
                class="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400"
              >
                <div class="flex items-center gap-1.5">
                  <Icon name="mdi:clock-outline" class="w-3.5 h-3.5" />
                  {{ format(draft.createdAt, dateFormat, { locale: dateLocale }) }}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                  @click.stop="deleteDraft(draft.id)"
                >
                  <Icon name="mdi:delete" class="w-4 h-4" />
                </Button>
              </div>
            </div>
          </button>
        </div>

        <div v-else class="text-center py-16 text-gray-500 dark:text-gray-400">
          <NuxtImg
            src="/topik_404_rm.png"
            width="100"
            height="100"
            class="mx-auto mb-5 opacity-70"
            :alt="$t('common.noResults')"
          />
          <p class="text-sm">{{ $t('common.noResults') }}</p>
        </div>
      </div>
    </template>
  </ModalMini>
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
  { value: 'newest', label: t('common.sortOptions.newest'), icon: 'mdi:clock-outline' },
  { value: 'oldest', label: t('common.sortOptions.oldest'), icon: 'mdi:clock' },
  { value: 'alphabetical', label: 'A-Z', icon: 'mdi:sort-alphabetical-ascending' },
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
    toast.success({ message: t('common.messages.deleteSuccess') })
  } catch {
    toast.error({ message: t('common.messages.deleteFailed') })
  }
}
</script>
