<template>
  <ArticleEditorPopover
    :label="$t('common.labels.tags')"
    icon="mdi:tag-outline"
    size="md"
    :filled="!!selected.length"
  >
    <template #trigger>{{ triggerLabel }}</template>

    <div class="flex flex-col gap-2 w-72">
      <input
        v-model="query"
        type="search"
        role="combobox"
        aria-expanded="true"
        :aria-controls="listId"
        :aria-activedescendant="rowCount ? `${listId}-${highlighted}` : undefined"
        :placeholder="$t('articles.editor.searchTags')"
        :aria-label="$t('articles.editor.searchTags')"
        class="w-full px-2.5 py-1.5 text-xs rounded-lg! border-gray-200! dark:border-gray-700!"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="commit"
      />

      <div
        v-if="rowCount"
        :id="listId"
        role="listbox"
        :aria-label="$t('common.labels.tags')"
        class="flex flex-col max-h-56 overflow-y-auto -mx-1"
      >
        <button
          v-for="(option, index) in options"
          :id="`${listId}-${index}`"
          :key="option.id"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="isSelected(option.id)"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs bg-transparent! hover:bg-gray-100! dark:hover:bg-gray-800!"
          :class="{ 'bg-gray-100! dark:bg-gray-800!': index === highlighted }"
          @click="toggle(option.id)"
          @mousemove="highlighted = index"
        >
          <Icon
            :name="isSelected(option.id) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'"
            class="w-3.5 h-3.5 shrink-0"
            :class="isSelected(option.id) ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600'"
            aria-hidden="true"
          />
          <!-- base.scss colours bare `span` directly, so the label cannot inherit from the row. -->
          <span class="truncate text-gray-700! dark:text-gray-200!">{{ option.name }}</span>
        </button>

        <button
          v-if="canCreate"
          :id="`${listId}-${options.length}`"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="false"
          :disabled="creating"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs bg-transparent! hover:bg-indigo-50! dark:hover:bg-indigo-950/40! border-t border-gray-100 dark:border-gray-800 rounded-t-none disabled:opacity-50"
          :class="{ 'bg-indigo-50! dark:bg-indigo-950/40!': highlighted === options.length }"
          @click="createTag"
          @mousemove="highlighted = options.length"
        >
          <Icon
            :name="creating ? 'mdi:loading' : 'mdi:plus'"
            class="w-3.5 h-3.5 shrink-0 text-indigo-500"
            :class="{ 'animate-spin motion-reduce:animate-none': creating }"
            aria-hidden="true"
          />
          <span class="truncate font-medium text-indigo-600! dark:text-indigo-300!">
            {{ $t('articles.editor.createTag', { name: query.trim() }) }}
          </span>
        </button>
      </div>

      <p v-else class="px-1 py-1.5 text-xs text-gray-400 dark:text-gray-500">
        {{ $t('articles.tags.noTagsFound') }}
      </p>
    </div>
  </ArticleEditorPopover>
</template>

<script setup lang="ts">
import slugify from 'slugify'

type TagOption = { id: string; name: string }

/** How many names the trigger spells out before it falls back to a count. */
const NAMES_SHOWN = 2

const tags = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()
const toast = useToast()
const requestFetch = useRequestFetch()
const { invalidateTags } = useCacheInvalidation()
const listId = useId()

const query = shallowRef('')
const creating = shallowRef(false)
const highlighted = shallowRef(0)

const { data: allTags } = useQuery({
  key: () => queryKeys.tags.list,
  query: () => requestFetch<TagOption[]>('/api/tags'),
  placeholderData: () => [],
})

const isSelected = (id: string) => tags.value.includes(id)

const selected = computed(() => (allTags.value ?? []).filter((tag) => isSelected(tag.id)))

// Selected rows keep their place in the list rather than sorting to the top: reordering under
// the cursor moves the next row you were aiming at, which is the reflow problem in miniature.
const options = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return (allTags.value ?? []).filter((tag) => !needle || tag.name.toLowerCase().includes(needle))
})

const canCreate = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return !!needle && !(allTags.value ?? []).some((tag) => tag.name.toLowerCase() === needle)
})

const rowCount = computed(() => options.value.length + (canCreate.value ? 1 : 0))

const triggerLabel = computed(
  () => tagTriggerLabel(selected.value.map((tag) => tag.name), NAMES_SHOWN) || t('articles.editor.addTag'),
)

watch(query, () => (highlighted.value = 0))
watch(rowCount, (count) => {
  if (highlighted.value >= count) highlighted.value = 0
})

const move = (delta: number) => (highlighted.value = wrapIndex(highlighted.value, delta, rowCount.value))

const toggle = (id: string) => {
  if (isSelected(id)) {
    tags.value = tags.value.filter((tag) => tag !== id)
    return
  }
  tags.value = [...tags.value, id]
  // Adding one usually means adding another; deselecting does not, and clearing there would
  // throw away the filter that found the tag you just changed your mind about.
  query.value = ''
}

const createTag = async () => {
  const name = query.value.trim()
  if (!name || creating.value) return

  creating.value = true
  try {
    const { id } = await $fetch('/api/tags', {
      method: 'POST',
      body: { name, slug: slugify(name, { lower: true, strict: true, trim: true }) },
    })
    await invalidateTags()
    toggle(id)
  } catch (e: any) {
    toast.error({ message: t('articles.tags.createFailed') + (e.data?.message ?? '') })
  } finally {
    creating.value = false
  }
}

const commit = () => {
  if (canCreate.value && highlighted.value === options.value.length) return createTag()

  const option = options.value[highlighted.value]
  if (option) toggle(option.id)
}
</script>
