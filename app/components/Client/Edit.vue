<template>
  <Modal v-model="open" :title="$t('master.clientEdit.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex-1 overflow-y-auto pr-4">
        <div class="flex flex-col gap-6">
          <FormField
            v-model="editedClient.name"
            :label="$t('master.clientEdit.fields.name.label')"
            :placeholder="$t('master.clientEdit.fields.name.placeholder')"
          />
          <FormField
            v-model="editedClient.domain"
            :label="$t('master.clientEdit.fields.domain.label')"
            :placeholder="$t('master.clientEdit.fields.domain.placeholder')"
          />
          <FormField
            v-model="editedClient.description"
            type="textarea"
            :label="$t('master.clientEdit.fields.description.label')"
            :placeholder="$t('master.clientEdit.fields.description.placeholder')"
            :maxLength="255"
          />
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientEdit.fields.logo.label')" />
            <FileUploader
              :imageUrl="editedClient.logoUrl"
              type="client-logo"
              @upload="((editedClient.logoUrl = $event.url), (editedClient.optimizedUrl = $event.optimizedUrl))"
            />
          </div>
          <FormField
            v-model="editedClient.audience"
            :label="$t('master.clientEdit.fields.audience.label')"
            :placeholder="$t('master.clientEdit.fields.audience.placeholder')"
          />
          <FormField
            v-model="editedClient.focus"
            :label="$t('master.clientEdit.fields.focus.label')"
            :placeholder="$t('master.clientEdit.fields.focus.placeholder')"
          />
          <div class="flex flex-col gap-3">
            <FormField
              v-model="keywordsInput"
              type="textarea"
              :label="$t('master.clientEdit.fields.keywords.label')"
              :placeholder="$t('master.clientEdit.fields.keywords.placeholder')"
              @input="updateKeywords"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400 -mt-2">{{
              $t('master.clientEdit.fields.keywords.count', [editedClient.keywords.length])
            }}</span>
          </div>
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientEdit.fields.plan.label')" />
            <FormSelect
              v-model="editedClient.plan"
              :items="[
                { label: 'Basic', value: 'BASIC' },
                { label: 'Pro', value: 'PRO' },
                { label: 'Premium', value: 'PREMIUM' },
                { label: 'Custom', value: 'CUSTOM' },
              ]"
              :showValue="false"
            />
          </div>
          <div class="flex flex-col gap-3">
            <FormLabel :text="$t('master.clientEdit.fields.generationFrequency.label')" />
            <FormSelect
              v-model="editedClient.generationFrequency"
              :items="[
                { label: $t('master.clientEdit.fields.generationFrequency.options.NONE'), value: 'NONE' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.DAILY'), value: 'DAILY' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.WEEKLY'), value: 'WEEKLY' },
              ]"
              :showValue="false"
            />
          </div>
          <FormField
            v-model.number="editedClient.tokenLimit"
            type="number"
            :label="$t('master.clientEdit.fields.tokenLimit.label')"
            :placeholder="$t('master.clientEdit.fields.tokenLimit.placeholder')"
            min="0"
          />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end flex-shrink-0">
        <Button variant="neutral" size="lg" @click="close">{{ $t('master.clientEdit.actions.close') }}</Button>
        <Button size="lg" :disabled="!isFormValid" @click="saveEdit">{{ $t('master.clientEdit.actions.save') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { ClientSite } from '@zenstackhq/runtime/models'

const props = defineProps<{ client: ClientSite }>()

const open = defineModel<boolean>()

const emit = defineEmits(['saved'])

const toast = useToast()
const { t } = useI18n()

const normalizeKeywords = (val: unknown): string[] => {
  return Array.isArray(val) ? val : []
}

const keywordsInput = ref(normalizeKeywords(props.client.keywords).join(', '))

const editedClient = ref({
  id: props.client.id,
  name: props.client.name,
  domain: props.client.domain,
  plan: props.client.plan,
  generationFrequency: props.client.generationFrequency,
  tokenLimit: props.client.tokenLimit,
  description: props.client.description || '',
  logoUrl: props.client.logoUrl || '',
  optimizedUrl: '',
  audience: props.client.audience || '',
  focus: props.client.focus || '',
  keywords: normalizeKeywords(props.client.keywords),
})

const isFormValid = computed(() => {
  const { name, domain } = editedClient.value
  return !!name && !!domain
})

const updateKeywords = () => {
  editedClient.value.keywords = keywordsInput.value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

const saveEdit = async () => {
  if (!isFormValid.value) return

  try {
    const response = await $fetch(`/api/clients/${editedClient.value.id}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...editedClient.value,
        logoUrl: editedClient.value.optimizedUrl || editedClient.value.logoUrl,
        keywords: editedClient.value.keywords.length ? editedClient.value.keywords : undefined,
      },
    })

    if (response?.clientSite) {
      toast.success({ message: t('master.clientEdit.messages.success') })
      emit('saved')
      open.value = false
    } else {
      throw new Error(t('master.clientEdit.messages.invalidResponse'))
    }
  } catch (error: any) {
    toast.error({
      message: error?.data?.message || error.data?.message || t('master.clientEdit.messages.updateFailed'),
    })
  }
}
</script>
