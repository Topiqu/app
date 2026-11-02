<template>
  <UModal
    v-model:open="open"
    :title="$t('series.createTitle')"
    :description="$t('series.createDescription')"
    :dismissible="!saving"
    :close="!saving"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <form :id="formId" class="flex flex-col gap-6" @submit.prevent="submit">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="$t('series.nameLabel')" required>
            <UInput
              v-model="name"
              :placeholder="$t('series.namePlaceholder')"
              :disabled="saving"
              maxlength="255"
              required
              autofocus
            />
          </UFormField>
          <UFormField :label="$t('series.descriptionLabel')">
            <UTextarea v-model="description" :disabled="saving" maxlength="500" :rows="2" />
          </UFormField>
        </div>
        <SeriesArticlePicker v-if="open" v-model="articles" :disabled="saving" />
        <UAlert v-if="submitError" color="error" icon="mdi:alert-circle-outline" :title="submitError" role="alert" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-muted" aria-live="polite">{{ $t('series.parts', articles.length) }}</p>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="open = false">
            {{ $t('common.actions.cancel') }}
          </UButton>
          <UButton type="submit" :form="formId" icon="mdi:plus" :loading="saving" :disabled="!name.trim()">
            {{ $t('series.createAction') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const formId = useId()
const name = shallowRef('')
const description = shallowRef('')
const articles = shallowRef<InternalApi['/api/series/articles']['get']['data']>([])
const saving = shallowRef(false)
const submitError = shallowRef('')
const toast = useToast()
const { invalidateArticles } = useCacheInvalidation()

watch(open, (value) => {
  if (!value) return
  name.value = ''
  description.value = ''
  articles.value = []
  submitError.value = ''
})

const submit = async () => {
  if (!name.value.trim() || saving.value) return
  saving.value = true
  submitError.value = ''
  try {
    await $fetch('/api/series', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        description: description.value.trim(),
        articleIds: articles.value.map(({ id }) => id),
      },
    })
  } catch (error) {
    submitError.value = fetchErrorMessage(error, $t('series.createFailed'))
    saving.value = false
    return
  }

  // Creation has succeeded even if refreshing another cached view fails.
  open.value = false
  saving.value = false
  toast.add({ color: 'success', title: $t('series.createSuccess') })
  emit('created')
  await invalidateArticles()
}
</script>
