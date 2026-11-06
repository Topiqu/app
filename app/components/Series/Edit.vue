<template>
  <UModal v-model:open="open" :title="$t('series.editTitle')" :dismissible="!saving" :close="!saving">
    <template #body>
      <form :id="formId" class="flex flex-col gap-4" @submit.prevent="submit">
        <UFormField :label="$t('series.nameLabel')" required>
          <UInput
            v-model="name"
            class="w-full"
            :placeholder="$t('series.namePlaceholder')"
            :disabled="saving"
            maxlength="255"
            required
            autofocus
          />
        </UFormField>
        <UFormField :label="$t('series.descriptionLabel')">
          <UTextarea v-model="description" class="w-full" :disabled="saving" maxlength="500" :rows="3" />
        </UFormField>
        <UAlert v-if="submitError" color="error" icon="mdi:alert-circle-outline" :title="submitError" role="alert" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="open = false">
          {{ $t('common.actions.cancel') }}
        </UButton>
        <UButton type="submit" :form="formId" :loading="saving" :disabled="!name.trim()">
          {{ $t('common.actions.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const { series } = defineProps<{ series: { id: string; name: string; description?: string | null } | null }>()
const emit = defineEmits<{ saved: [] }>()
const formId = useId()
const name = shallowRef('')
const description = shallowRef('')
const saving = shallowRef(false)
const submitError = shallowRef('')
const toast = useToast()
const { invalidateArticles } = useCacheInvalidation()

watch(open, (value) => {
  if (!value) return
  name.value = series?.name ?? ''
  description.value = series?.description ?? ''
  submitError.value = ''
})

const submit = async () => {
  if (!series || !name.value.trim() || saving.value) return
  saving.value = true
  submitError.value = ''
  try {
    await $fetch(`/api/series/${series.id}` as '/api/series/:id', {
      method: 'PATCH',
      body: { name: name.value.trim(), description: description.value.trim() || null },
    })
  } catch (error) {
    // A duplicate name answers 409 with its own message, which says more than a generic failure.
    submitError.value = fetchErrorMessage(error, $t('common.messages.saveFailed'))
    saving.value = false
    return
  }

  open.value = false
  saving.value = false
  toast.add({ color: 'success', title: $t('common.messages.saveSuccess') })
  emit('saved')
  await invalidateArticles()
}
</script>
