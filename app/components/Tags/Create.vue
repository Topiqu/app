<template>
  <UModal v-model:open="open" :title="$t('articles.tags.manageTags')" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <UFormField :label="$t('common.labels.tagName')" :error="isDuplicate ? $t('articles.tags.duplicate') : undefined">
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <UInput
            v-model="newTag.name"
            :placeholder="$t('common.labels.tagName')"
            class="w-full"
            :color="isDuplicate ? 'error' : 'primary'"
            :highlight="isDuplicate"
            @input="updateSlug"
          />
          <UButton :disabled="isDuplicate || !newTag.name.trim()" @click="createTag">
            {{ $t('articles.tags.addButton') }}
          </UButton>
        </div>
      </UFormField>

      <div class="flex flex-col gap-4">
        <UFormField :label="$t('articles.tags.searchPlaceholder')" :ui="{ label: 'sr-only' }">
          <UInput
            v-model="searchQuery"
            :placeholder="$t('articles.tags.searchPlaceholder')"
            icon="mdi:magnify"
            class="w-full"
          />
        </UFormField>
        <UProgress v-if="status === 'pending'" />
        <UAlert
          v-else-if="error"
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
        <div v-else-if="filteredTags.length" class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="t in filteredTags"
            :key="t.id"
            class="flex min-w-0 items-center gap-2 rounded-[var(--ui-radius)] border border-default bg-elevated p-2"
          >
            <span
              v-if="editingTagId !== t.id"
              class="min-w-0 flex-1 truncate px-2 text-sm font-medium text-highlighted"
              :title="t.name"
              >{{ t.name }}</span
            >
            <UButton
              v-if="editingTagId !== t.id"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="mdi:pencil"
              :aria-label="$t('common.actions.edit')"
              :title="$t('common.actions.edit')"
              @click="startEditing(t.id)"
            />
            <template v-else>
              <UFormField
                :label="$t('common.labels.tagName')"
                :error="editError"
                :ui="{ label: 'sr-only' }"
                class="min-w-0 flex-1"
              >
                <UInput v-model="editDraft" class="w-full" @keyup.enter="saveEdit(t)" @keyup.esc="cancelEdit" />
              </UFormField>
              <UButton
                color="primary"
                size="sm"
                square
                icon="mdi:check"
                :aria-label="$t('common.actions.saveChanges')"
                @click="saveEdit(t)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                square
                icon="mdi:close"
                :aria-label="$t('common.actions.cancel')"
                @click="cancelEdit"
              />
            </template>
            <UButton
              v-if="editingTagId !== t.id"
              color="neutral"
              variant="ghost"
              class="tag-destructive-control"
              size="sm"
              square
              icon="mdi:delete"
              :aria-label="$t('common.actions.deleteTag')"
              :title="$t('common.actions.deleteTag')"
              @click="deleteTag(t.id, t.name)"
            />
          </div>
        </div>
        <UEmpty v-else size="sm" :description="$t('articles.tags.noTagsFound')" />
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">
        {{ $t('common.close') }}
      </UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import slugify from 'slugify'

const open = defineModel<boolean>({ default: false })
const toast = useToast()
const confirm = useConfirm()
const { data: tags, refresh, status, error } = useFetch('/api/tags', { default: () => [], immediate: false })
const newTag = reactive({ name: '', slug: '' })
const searchQuery = shallowRef('')
const editingTagId = shallowRef<string | null>(null)
const editDraft = shallowRef('')

watch(open, (isOpen) => {
  if (isOpen) refresh()
})

const filteredTags = computed(() =>
  tags.value.filter((t) => t.name.toLowerCase().includes(searchQuery.value.toLowerCase())),
)
const isDuplicate = computed(() => tags.value.some((t) => t.name.toLowerCase() === newTag.name.trim().toLowerCase()))

const updateSlug = () => {
  newTag.slug = slugify(newTag.name, {
    lower: true,
    strict: true,
    trim: true,
  })
}

const createTag = async () => {
  if (!newTag.name.trim() || isDuplicate.value) return
  try {
    await $fetch('/api/tags', {
      method: 'POST',
      body: {
        name: newTag.name,
        slug: newTag.slug,
      },
    })
    Object.assign(newTag, { name: '', slug: '' })
    await refresh()
    toast.add({ color: 'success', title: $t('articles.tags.createSuccess') })
  } catch (error: any) {
    toast.add({ color: 'error', title: $t('articles.tags.createFailed') + error.data?.message })
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
  try {
    await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
  } catch (error: any) {
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') + error.data?.message })
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
  return tags.value.some((tag) => tag.id !== editingTagId.value && tag.name.toLowerCase() === name.toLowerCase())
    ? $t('articles.tags.duplicate')
    : undefined
})

const saveEdit = async (tag: { id: string }) => {
  const name = editDraft.value.trim()
  if (!name || editError.value) return
  try {
    await $fetch(`/api/tags/${tag.id}`, {
      method: 'PATCH',
      body: { name, slug: slugify(name, { lower: true, strict: true, trim: true }) },
    })
    await refresh()
    cancelEdit()
    toast.add({ color: 'success', title: $t('articles.tags.updateSuccess') })
  } catch (error: any) {
    toast.add({ color: 'error', title: $t('articles.tags.updateFailed') + error.data?.message })
  }
}
</script>
