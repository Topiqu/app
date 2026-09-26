<template>
  <UModal v-model:open="open" :title="$t('knowledge.addTitle')" :description="$t('knowledge.addDescription')">
    <template #body>
      <form id="knowledge-add" class="flex flex-col gap-4" @submit.prevent="submit">
        <UTabs v-model="kind" :items="kindTabs" :content="false" class="w-full" />

        <template v-if="kind === 'NOTE'">
          <UFormField :label="$t('knowledge.fields.title')" required>
            <UInput v-model="form.title" class="w-full" maxlength="200" required />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.note')" :hint="$t('knowledge.fields.noteHint')" required>
            <UTextarea v-model="form.text" class="w-full" :rows="8" autoresize :maxrows="16" required />
          </UFormField>
        </template>
        <template v-else-if="kind === 'FILE'">
          <UFileUpload
            v-model="file"
            accept=".pdf,.docx,.txt,.md"
            icon="mdi:file-upload-outline"
            :label="$t('knowledge.fields.file')"
            :aria-label="$t('knowledge.fields.file')"
            :description="$t('knowledge.fields.fileHint', { size: maxSize })"
            :preview="false"
            class="min-h-36 w-full"
          />
          <UFormField :label="$t('knowledge.fields.title')" :hint="$t('knowledge.fields.optional')">
            <UInput v-model="form.title" class="w-full" maxlength="200" />
          </UFormField>
        </template>
        <template v-else>
          <UFormField :label="$t('knowledge.fields.url')" :hint="$t('knowledge.fields.urlHint')" required>
            <UInput v-model="form.url" type="url" class="w-full" placeholder="https://" required />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.title')" :hint="$t('knowledge.fields.optional')">
            <UInput v-model="form.title" class="w-full" maxlength="200" />
          </UFormField>
        </template>

        <UFormField :label="$t('knowledge.fields.validAsOf')" :hint="$t('knowledge.fields.validAsOfAddHint')">
          <UInput v-model="form.validAsOf" type="date" class="w-full" :max="today" />
        </UFormField>

        <USwitch
          v-model="form.useInArticles"
          :label="$t('knowledge.useInArticles')"
          :aria-label="$t('knowledge.useInArticles')"
          :description="$t('knowledge.useInArticlesHint')"
        />
        <USwitch
          v-model="form.isPublic"
          :label="$t('knowledge.public')"
          :aria-label="$t('knowledge.public')"
          :description="$t('knowledge.publicHint')"
        />
        <UFormField v-if="form.isPublic && kind !== 'URL'" :label="$t('knowledge.fields.publicUrl')" required>
          <UInput v-model="form.publicUrl" type="url" class="w-full" placeholder="https://" required />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('knowledge.cancel') }}</UButton>
        <UButton type="submit" form="knowledge-add" :loading="saving" :disabled="kind === 'FILE' && !file">
          {{ $t('knowledge.add') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'

const emit = defineEmits<{ created: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useAppToast()

type Kind = 'NOTE' | 'FILE' | 'URL'
const kind = shallowRef<Kind>('NOTE')
const kindTabs = computed(() =>
  (['NOTE', 'FILE', 'URL'] as const).map((value) => ({ value, label: t(`knowledge.kinds.${value}`) })),
)
const file = shallowRef<File | null>(null)
const saving = shallowRef(false)
const blank = () => ({ title: '', text: '', url: '', publicUrl: '', validAsOf: '', useInArticles: true, isPublic: false })
const today = new Date().toISOString().slice(0, 10)
const form = reactive(blank())
const maxSize = `${KNOWLEDGE_LIMITS.maxFileBytes / 1024 / 1024} MB`

watch(open, (value) => {
  if (value) return
  Object.assign(form, blank())
  file.value = null
  kind.value = 'NOTE'
})

const submit = async () => {
  const body = new FormData()
  body.set('kind', kind.value)
  body.set('useInArticles', String(form.useInArticles))
  body.set('isPublic', String(form.isPublic))
  if (form.title.trim()) body.set('title', form.title.trim())
  if (form.validAsOf) body.set('validAsOf', form.validAsOf)
  if (kind.value === 'NOTE') body.set('text', form.text)
  if (kind.value === 'URL') body.set('url', form.url.trim())
  if (kind.value === 'FILE' && file.value) body.set('file', file.value)
  if (form.isPublic && kind.value !== 'URL') body.set('publicUrl', form.publicUrl.trim())

  saving.value = true
  try {
    await $fetch('/api/knowledge', { method: 'POST', body })
    toast.success({ message: t('knowledge.added') })
    open.value = false
    emit('created')
  } catch (cause: any) {
    const code = cause?.data?.data?.code
    toast.error({
      message:
        code === 'KNOWLEDGE_DUPLICATE'
          ? t('knowledge.errors.duplicate')
          : code === 'KNOWLEDGE_QUOTA'
            ? t('knowledge.errors.quota')
            : cause?.data?.message || t('knowledge.actionError'),
    })
  } finally {
    saving.value = false
  }
}
</script>
