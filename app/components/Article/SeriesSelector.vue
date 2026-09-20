<template>
  <div class="flex flex-col gap-2 w-full">
    <span class="ml-1 text-xs font-bold uppercase tracking-wider text-muted">
      {{ $t('series.label') }}
    </span>

    <UDropdownMenu :items="dropdownGroups" class="w-full">
      <template #default="{ open }">
        <UButton
          :color="open ? 'primary' : 'neutral'"
          :variant="open ? 'soft' : 'outline'"
          class="w-full"
          trailingIcon="mdi:chevron-down"
        >
          <span
            class="break-words text-left text-sm font-medium transition-colors"
            :class="modelValue ? 'text-highlighted' : 'text-muted'"
          >
            {{ modelValue ? modelValue.name : $t('series.placeholder') }}
          </span>
        </UButton>
      </template>
    </UDropdownMenu>

    <UCard v-if="modelValue" class="mt-1">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 overflow-hidden">
          <UIcon name="mdi:playlist-play" size="20" class="shrink-0" />
          <div class="flex flex-col min-w-0">
            <span class="break-words text-sm font-semibold text-highlighted">
              {{ modelValue.name }}
            </span>
            <span class="text-xs text-muted font-medium">
              {{ $t('series.part', { count: (modelValue.articles?.length ?? 0) + 1 }, '{count}. díl') }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <UButton
            color="neutral"
            variant="ghost"
            type="button"
            square
            icon="mdi:pencil-outline"
            :title="$t('common.actions.edit')"
            @click="openEdit"
          />
          <UButton
            color="error"
            variant="ghost"
            type="button"
            square
            icon="mdi:close"
            :title="$t('series.removeArticle')"
            @click="modelValue = null"
          />
        </div>
      </div>
    </UCard>

    <UModal v-model:open="createModal" :title="$t('series.createTitle', 'Vytvořit novou sérii')">
      <template #body>
        <div class="flex flex-col gap-4 py-2">
          <UFormField :label="$t('series.nameLabel')">
            <UInput
              v-model="newSeriesName"
              class="w-full"
              :placeholder="$t('series.namePlaceholder', 'Např. Úvod do Vue 3...')"
              autofocus
              @keyup.enter="createAndSelect"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="createModal = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton
            size="sm"
            color="primary"
            icon="mdi:check"
            :disabled="!newSeriesName.trim()"
            @click="createAndSelect"
          >
            {{ $t('common.continue') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="editModal" :title="$t('series.editTitle')">
      <template #body>
        <div class="flex flex-col gap-4 py-2">
          <UFormField :label="$t('series.nameLabel')">
            <UInput
              v-model="editedSeriesName"
              class="w-full"
              :placeholder="$t('series.namePlaceholder')"
              autofocus
              @keyup.enter="saveSeries"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center gap-2">
          <UButton color="error" variant="ghost" :loading="deleting" @click="deleteSeries">
            {{ $t('common.actions.delete') }}
          </UButton>
          <div class="flex-1" />
          <UButton color="neutral" variant="ghost" @click="editModal = false">
            {{ $t('common.actions.cancel') }}
          </UButton>
          <UButton color="primary" :loading="saving" :disabled="!editedSeriesName.trim()" @click="saveSeries">
            {{ $t('common.actions.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'

const modelValue = defineModel<any>({ default: null })

defineProps<{ compact?: boolean }>()

const { data: series, refresh } = await useLazyFetch<any[]>('/api/series', {
  server: false,
  default: () => [],
})

const createModal = shallowRef(false)
const newSeriesName = shallowRef('')
const editModal = shallowRef(false)
const editedSeriesName = shallowRef('')
const saving = shallowRef(false)
const deleting = shallowRef(false)
const toast = useToast()
const confirm = useConfirm()

const seriesItems = computed(() =>
  series.value.map((s) => ({
    id: s.id,
    label: s.name,
    icon: 'mdi:bookmark-outline',
    onSelect: () => (modelValue.value = s),
  })),
)

const createItem = computed(() => ({
  id: 'create',
  label: $t('series.createNew', 'Vytvořit novou sérii...'),
  icon: 'mdi:plus-circle-outline',
  onSelect: () => (createModal.value = true),
}))

const dropdownGroups = computed(() => [seriesItems.value, [createItem.value]])

const createAndSelect = async () => {
  if (!newSeriesName.value.trim()) return

  try {
    const newSeries = await $fetch('/api/series', {
      method: 'POST',
      body: {
        name: newSeriesName.value.trim(),
        slug: slugify(newSeriesName.value.trim(), { lower: true, strict: true }),
      },
    })
    await refresh()
    modelValue.value = newSeries
    createModal.value = false
    newSeriesName.value = ''
  } catch {
    toast.add({ color: 'error', title: $t('series.createFailed') })
  }
}

const openEdit = () => {
  if (!modelValue.value) return
  editedSeriesName.value = modelValue.value.name
  editModal.value = true
}

const saveSeries = async () => {
  if (!modelValue.value?.id || !editedSeriesName.value.trim() || saving.value) return
  saving.value = true
  try {
    const updated = await $fetch(`/api/series/${modelValue.value.id}`, {
      method: 'PATCH',
      body: { name: editedSeriesName.value.trim() },
    })
    modelValue.value = { ...modelValue.value, ...updated }
    await refresh()
    editModal.value = false
    toast.add({ color: 'success', title: $t('common.messages.saveSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.saveFailed') })
  } finally {
    saving.value = false
  }
}

const deleteSeries = async () => {
  if (!modelValue.value?.id || deleting.value) return
  const accepted = await confirm({
    title: $t('series.deleteTitle'),
    message: $t('series.deleteDescription'),
    icon: 'mdi:playlist-remove',
    confirmText: $t('common.actions.delete'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (!accepted) return

  deleting.value = true
  try {
    await $fetch(`/api/series/${modelValue.value.id}`, { method: 'DELETE' })
    modelValue.value = null
    editModal.value = false
    await refresh()
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') })
  } finally {
    deleting.value = false
  }
}
</script>
