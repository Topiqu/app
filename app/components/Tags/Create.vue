<template>
  <UModal
    v-model:open="open"
    :title="$t('articles.tags.manageTags')"
    :ui="{ content: 'sm:max-w-lg' }"
    :content="{ onEscapeKeyDown }"
  >
    <template #body>
      <form class="flex gap-2" @submit.prevent="createTag">
        <UFormField :label="$t('articles.tags.searchOrAdd')" :ui="{ label: 'sr-only' }" class="min-w-0 flex-1">
          <UInput
            v-model="query"
            :placeholder="$t('articles.tags.searchOrAdd')"
            icon="mdi:magnify"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          icon="mdi:plus"
          :label="$t('articles.tags.addButton')"
          :disabled="!query.trim() || Boolean(exactMatch)"
          :loading="creating"
        />
      </form>

      <UProgress v-if="status === 'pending'" size="xs" class="mt-5" />
      <UAlert
        v-else-if="error"
        class="mt-5"
        color="error"
        icon="mdi:alert-circle-outline"
        :title="$t('common.messages.loadFailedTitle')"
      >
        <template #actions>
          <UButton icon="mdi:refresh" color="error" variant="soft" @click="refresh()">
            {{ $t('common.messages.retry') }}
          </UButton>
        </template>
      </UAlert>
      <template v-else-if="filteredTags.length">
        <ul class="mt-5 flex max-h-80 flex-wrap content-start gap-1.5 overflow-y-auto" :aria-label="$t('articles.tags.manageTags')">
          <li
            v-for="t in filteredTags"
            :key="t.id"
            :data-tag-id="t.id"
            tabindex="-1"
            class="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-md border p-0.5 outline-none transition-colors"
            :class="[
              editingTagId === t.id ? 'border-primary' : 'border-default',
              pendingTagIds.has(t.id) ? 'opacity-60' : '',
            ]"
          >
            <UInput
              v-if="editingTagId === t.id"
              v-model="editDraft"
              variant="none"
              size="xs"
              :aria-label="$t('common.labels.tagName')"
              :aria-invalid="Boolean(editError)"
              :aria-describedby="editError ? editErrorId : undefined"
              :ui="{ base: 'min-w-16' }"
              :style="{ width: `${editDraft.length + 4}ch` }"
              autofocus
              @keydown.enter.prevent="saveEdit(t)"
              @blur="commitOnBlur(t)"
            />
            <template v-else>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :label="t.name"
                class="min-w-0 cursor-text"
                :ui="{ label: 'max-w-64 truncate' }"
                :title="$t('articles.tags.renameNamed', { name: t.name })"
                :aria-label="$t('articles.tags.renameNamed', { name: t.name })"
                :disabled="pendingTagIds.has(t.id)"
                @click="startEditing(t.id)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                class="tag-destructive-control"
                icon="mdi:close"
                size="xs"
                square
                :aria-label="$t('common.actions.deleteTag')"
                :title="$t('common.actions.deleteTag')"
                :loading="pendingTagIds.has(t.id)"
                :disabled="pendingTagIds.has(t.id)"
                @click="deleteTag(t.id, t.name)"
              />
            </template>
          </li>
        </ul>
        <p v-if="editingTagId && editError" :id="editErrorId" class="mt-2 text-xs text-error" role="alert">
          {{ editError }}
        </p>
      </template>
      <UEmpty
        v-else
        class="mt-5"
        size="sm"
        icon="mdi:tag-off-outline"
        :description="$t('articles.tags.noTagsFound')"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import slugify from 'slugify'

type TagItem = { id: string; name: string }

const open = defineModel<boolean>({ default: false })
const toast = useToast()
const confirm = useConfirm()
const {
  data: tags,
  refresh,
  status,
  error,
} = useFetch<TagItem[]>('/api/tags', {
  default: () => [],
  immediate: false,
  // Optimistic edits push, splice and rename in place; a shallow ref would not re-render them.
  deep: true,
})
const query = shallowRef('')
const editingTagId = shallowRef<string | null>(null)
const editDraft = shallowRef('')
const editErrorId = useId()
const creating = shallowRef(false)
const pendingTagIds = ref(new Set<string>())
const optimisticStatus = useOptimisticStatus()

watch(open, (isOpen) => {
  if (isOpen) refresh()
})

const toSlug = (name: string) => slugify(name, { lower: true, strict: true, trim: true })
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const filteredTags = computed(() =>
  tags.value.filter((t) => t.name.toLowerCase().includes(query.value.trim().toLowerCase())),
)
const exactMatch = computed(() => tags.value.find((t) => sameName(t.name, query.value)))

const focusTag = async (id: string | undefined) => {
  await nextTick()
  if (!id) return
  const chip = document.querySelector<HTMLElement>(`[data-tag-id="${id}"]`)
  ;(chip?.querySelector<HTMLElement>('button') ?? chip)?.focus()
}

// Escape while renaming cancels the rename instead of closing the whole modal.
const onEscapeKeyDown = (event: KeyboardEvent) => {
  if (!editingTagId.value) return
  event.preventDefault()
  const id = editingTagId.value
  cancelEdit()
  focusTag(id)
}

const createTag = async () => {
  const name = query.value.trim()
  if (!name || exactMatch.value || creating.value) return
  const draft = { name, slug: toSlug(name) }
  const optimisticId = `optimistic-${crypto.randomUUID?.() ?? Date.now()}`
  creating.value = true
  tags.value.push({ id: optimisticId, name })
  query.value = ''
  optimisticStatus.saving()
  try {
    const created = await $fetch<{ id: string; name: string }>('/api/tags', {
      method: 'POST',
      body: draft,
    })
    const index = tags.value.findIndex((tag) => tag.id === optimisticId)
    if (index >= 0) tags.value.splice(index, 1, created)
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('articles.tags.createSuccess') })
  } catch (error: any) {
    tags.value = tags.value.filter((tag) => tag.id !== optimisticId)
    query.value = name
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: $t('articles.tags.createFailed') + error.data?.message })
  } finally {
    creating.value = false
  }
}

const confirmDelete = async (name: string) => {
  const r = await confirm({
    title: $t('common.messages.deleteConfirmTitle'),
    message: $t('articles.tags.deleteConfirmText', [name]),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.actions.delete'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  return r
}

const deleteTag = async (id: string, name: string) => {
  const confirmed = await confirmDelete(name)
  if (!confirmed) return
  const index = tags.value.findIndex((tag) => tag.id === id)
  if (index < 0 || pendingTagIds.value.has(id)) return
  const removed = tags.value[index]!
  const focusId = tags.value[index + 1]?.id ?? tags.value[index - 1]?.id
  tags.value.splice(index, 1)
  pendingTagIds.value = new Set([...pendingTagIds.value, id])
  optimisticStatus.saving()
  await focusTag(focusId)
  try {
    await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
  } catch (error: any) {
    tags.value.splice(index, 0, removed)
    optimisticStatus.reverted()
    await focusTag(id)
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') + error.data?.message })
  } finally {
    const pending = new Set(pendingTagIds.value)
    pending.delete(id)
    pendingTagIds.value = pending
  }
}

const startEditing = (id: string) => {
  editingTagId.value = id
  editDraft.value = tags.value.find((tag) => tag.id === id)?.name ?? ''
}

const cancelEdit = () => {
  editingTagId.value = null
  editDraft.value = ''
}

const editError = computed(() => {
  const name = editDraft.value.trim()
  if (!name) return $t('articles.tags.emptyName')
  return tags.value.some((tag) => tag.id !== editingTagId.value && sameName(tag.name, name))
    ? $t('articles.tags.duplicate')
    : undefined
})

// Clicking away keeps a valid rename and silently drops an invalid one; Enter is the path that reports errors.
const commitOnBlur = (tag: TagItem) => {
  if (editingTagId.value !== tag.id) return
  if (editError.value) cancelEdit()
  else saveEdit(tag, false)
}

const saveEdit = async (tag: TagItem, refocus = true) => {
  const name = editDraft.value.trim()
  if (!name || editError.value || pendingTagIds.value.has(tag.id)) return
  const target = tags.value.find((item) => item.id === tag.id)
  if (!target) return
  if (name === target.name) {
    cancelEdit()
    if (refocus) focusTag(tag.id)
    return
  }
  const previousName = target.name
  target.name = name
  pendingTagIds.value = new Set([...pendingTagIds.value, tag.id])
  cancelEdit()
  if (refocus) focusTag(tag.id)
  optimisticStatus.saving()
  try {
    const response = await $fetch<{ tag: { name: string } }>(`/api/tags/${tag.id}`, {
      method: 'PATCH',
      body: { name, slug: toSlug(name) },
    })
    target.name = response.tag.name
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('articles.tags.updateSuccess') })
  } catch (error: any) {
    target.name = previousName
    editingTagId.value = tag.id
    editDraft.value = name
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: $t('articles.tags.updateFailed') + error.data?.message })
  } finally {
    const pending = new Set(pendingTagIds.value)
    pending.delete(tag.id)
    pendingTagIds.value = pending
  }
}
</script>
