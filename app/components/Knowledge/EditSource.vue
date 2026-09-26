<template>
  <UModal v-model:open="open" :title="$t('knowledge.editTitle')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true">
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>
      <div v-else class="flex flex-col gap-6">
        <form id="knowledge-edit" class="flex flex-col gap-4" @submit.prevent="save">
          <UFormField :label="$t('knowledge.fields.title')" required>
            <UInput v-model="form.title" class="w-full" maxlength="200" required />
          </UFormField>
          <UFormField v-if="isNote" :label="$t('knowledge.fields.note')" required>
            <UTextarea v-model="form.text" class="w-full" :rows="8" autoresize :maxrows="16" required />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.validAsOf')" :hint="$t('knowledge.fields.validAsOfHint')">
            <UInput v-model="form.validAsOf" type="date" class="w-full" :max="today" />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.publicUrl')" :hint="$t('knowledge.fields.publicUrlHint')">
            <UInput v-model="form.publicUrl" type="url" class="w-full" placeholder="https://" />
          </UFormField>
        </form>

        <section v-if="chunks.length" :aria-labelledby="passagesId">
          <h3 :id="passagesId" class="text-sm font-semibold text-highlighted">
            {{ $t('knowledge.passages', { count: chunks.length }) }}
          </h3>
          <p class="mt-1 text-xs text-muted">{{ $t('knowledge.passagesHint') }}</p>
          <ol class="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
            <li
              v-for="chunk in chunks"
              :key="chunk.ordinal"
              class="whitespace-pre-line rounded-md border border-default p-3 text-xs text-muted"
            >
              {{ chunk.content }}
            </li>
          </ol>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('knowledge.cancel') }}</UButton>
        <UButton type="submit" form="knowledge-edit" :loading="saving" :disabled="loading">
          {{ $t('knowledge.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useAppToast()
const passagesId = useId()
const today = new Date().toISOString().slice(0, 10)

const loading = shallowRef(false)
const saving = shallowRef(false)
const isNote = shallowRef(false)
type Chunk = { ordinal: number; content: string }
type Detail = {
  source: { kind: string; title: string; content: string | null; publicUrl: string | null; validAsOf: string | null }
  chunks: Chunk[]
}
const chunks = shallowRef<Chunk[]>([])
const form = reactive({ title: '', text: '', publicUrl: '', validAsOf: '' })

watch([open, () => props.id], async ([value, id]) => {
  if (!value || !id) return
  loading.value = true
  try {
    const { source, chunks: preview } = await $fetch<Detail>(`/api/knowledge/${id}`)
    isNote.value = source.kind === 'NOTE'
    chunks.value = preview
    Object.assign(form, {
      title: source.title,
      text: source.content ?? '',
      publicUrl: source.publicUrl ?? '',
      validAsOf: source.validAsOf ? String(source.validAsOf).slice(0, 10) : '',
    })
  } catch {
    toast.error({ message: t('knowledge.loadError') })
    open.value = false
  } finally {
    loading.value = false
  }
})

const save = async () => {
  saving.value = true
  try {
    await $fetch(`/api/knowledge/${props.id}`, {
      method: 'PATCH',
      body: {
        title: form.title.trim(),
        publicUrl: form.publicUrl.trim() || null,
        validAsOf: form.validAsOf || null,
        ...(isNote.value ? { text: form.text } : {}),
      },
    })
    toast.success({ message: t('knowledge.saved') })
    open.value = false
    emit('saved')
  } catch (cause: any) {
    toast.error({ message: cause?.data?.message || t('knowledge.actionError') })
  } finally {
    saving.value = false
  }
}
</script>
