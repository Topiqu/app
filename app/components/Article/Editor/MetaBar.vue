<template>
  <section
    class="custom-ui flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-x-6 gap-y-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
    :aria-label="$t('articles.editor.metaBar')"
  >
    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.tags') }}</h2>
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-for="tag in selectedTags"
          :key="tag.id"
          class="inline-flex items-center gap-1 h-8 pl-3 pr-1.5 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200"
        >
          {{ tag.name }}
          <button
            type="button"
            class="w-5 h-5 flex items-center justify-center rounded-full bg-transparent! hover:bg-gray-200! dark:hover:bg-gray-700! text-gray-400 hover:text-red-500"
            :aria-label="`${$t('common.actions.delete')} ${tag.name}`"
            @click="removeTag(tag.id)"
          >
            <Icon name="mdi:close" class="w-3.5 h-3.5" />
          </button>
        </span>

        <ArticleEditorPopover :label="$t('articles.editor.addTag')" icon="mdi:tag-plus-outline" size="md">
          <template #trigger>{{ $t('articles.editor.addTag') }}</template>

          <div class="flex flex-col gap-2 w-60">
            <input
              v-model="tagQuery"
              type="search"
              :placeholder="$t('articles.editor.searchTags')"
              :aria-label="$t('articles.editor.searchTags')"
              class="w-full px-2.5 py-1.5 text-xs rounded-lg! border-gray-200! dark:border-gray-700!"
            />

            <div v-if="matchingTags.length" class="flex flex-col max-h-48 overflow-y-auto -mx-1">
              <button
                v-for="tag in matchingTags"
                :key="tag.id"
                type="button"
                class="px-2 py-1.5 rounded-lg text-left text-xs bg-transparent! hover:bg-gray-100! dark:hover:bg-gray-800! text-gray-700! dark:text-gray-200!"
                @click="addTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
            <p v-else-if="!canCreate" class="px-1 py-1.5 text-xs text-gray-400 dark:text-gray-500">
              {{ $t('articles.tags.noTagsFound') }}
            </p>

            <button
              v-if="canCreate"
              type="button"
              :disabled="creating"
              class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs font-medium bg-transparent! hover:bg-indigo-50! dark:hover:bg-indigo-950/40! text-indigo-600! dark:text-indigo-300! border-t border-gray-100 dark:border-gray-800 rounded-t-none disabled:opacity-50"
              @click="createTag"
            >
              <Icon
                :name="creating ? 'mdi:loading' : 'mdi:plus'"
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': creating }"
              />
              {{ $t('articles.editor.createTag', { name: tagQuery.trim() }) }}
            </button>
          </div>
        </ArticleEditorPopover>
      </div>
    </div>

    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.series') }}</h2>
      <ArticleSeriesSelector v-model="series" compact />
    </div>

    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.releaseDate') }}</h2>
      <ArticleEditorPopover
        :label="$t('common.labels.releaseDate')"
        icon="mdi:calendar-clock"
        size="md"
        :active="!!releaseAt"
        align="right"
      >
        <template #trigger>{{ releaseLabel }}</template>

        <div class="flex flex-col gap-2 w-60">
          <FormField v-model="releaseAtInput" type="datetime-local" inputClass="text-xs! py-1.5!" />
          <div class="flex flex-wrap gap-1.5">
            <ArticleEditorChip v-for="kind in QUICK_KINDS" :key="kind" @click="setQuick(kind)">
              {{ $t(`articles.releaseQuick.${kind}`) }}
            </ArticleEditorChip>
            <ArticleEditorChip v-if="releaseAt" icon="mdi:close" @click="setQuick('clear')">
              {{ $t('articles.releaseQuick.clear') }}
            </ArticleEditorChip>
          </div>
          <p class="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            {{ $t('articles.editor.releaseDateNote') }}
          </p>
        </div>
      </ArticleEditorPopover>
    </div>
  </section>
</template>

<script setup lang="ts">
import slugify from 'slugify'

type TagOption = { id: string; name: string }

const series = defineModel<any>('series')
const tags = defineModel<string[]>('tags', { default: () => [] })
const releaseAt = defineModel<string | Date | null>('releaseAt')

const { t } = useI18n()
const toast = useToast()
const requestFetch = useRequestFetch()
const { formatTime } = useTime()
const { invalidateTags } = useCacheInvalidation()

const QUICK_KINDS = ['now', 'inHour', 'tomorrow'] as const

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500 dark:text-gray-400'

const tagQuery = shallowRef('')
const creating = shallowRef(false)

const { data: allTags } = useQuery({
  key: () => queryKeys.tags.list,
  query: () => requestFetch<TagOption[]>('/api/tags'),
  placeholderData: () => [],
})

const selectedTags = computed(() => (allTags.value ?? []).filter((tag) => tags.value.includes(tag.id)))

const matchingTags = computed(() => {
  const query = tagQuery.value.trim().toLowerCase()
  return (allTags.value ?? [])
    .filter((tag) => !tags.value.includes(tag.id))
    .filter((tag) => !query || tag.name.toLowerCase().includes(query))
})

const canCreate = computed(() => {
  const query = tagQuery.value.trim().toLowerCase()
  return !!query && !(allTags.value ?? []).some((tag) => tag.name.toLowerCase() === query)
})

const releaseLabel = computed(() =>
  releaseAt.value ? formatTime(releaseAt.value, 'shortDatetime') : t('articles.editor.publishImmediately'),
)

const releaseAtInput = computed<string | null>({
  get: () => toDateTimeLocal(releaseAt.value),
  set: (value) => (releaseAt.value = value),
})

const setQuick = (kind: ReleaseQuick) => (releaseAt.value = releaseQuickValue(kind))

const addTag = (id: string) => {
  if (!tags.value.includes(id)) tags.value = [...tags.value, id]
  tagQuery.value = ''
}

const removeTag = (id: string) => (tags.value = tags.value.filter((tag) => tag !== id))

const createTag = async () => {
  const name = tagQuery.value.trim()
  if (!name || creating.value) return

  creating.value = true
  try {
    const { id } = await $fetch('/api/tags', {
      method: 'POST',
      body: { name, slug: slugify(name, { lower: true, strict: true, trim: true }) },
    })
    await invalidateTags()
    addTag(id)
  } catch (e: any) {
    toast.error({ message: t('articles.tags.createFailed') + (e.data?.message ?? '') })
  } finally {
    creating.value = false
  }
}
</script>
