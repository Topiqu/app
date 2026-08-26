<template>
  <USlideover v-model:open="open" :title="$t('master.clientEdit.title')">
    <slot :open="open" />

    <template #body>
      <div>
        <div class="flex flex-col gap-6">
          <UFormField :label="$t('master.clientEdit.fields.name.label')">
            <UInput v-model="editedClient.name" :placeholder="$t('master.clientEdit.fields.name.placeholder')" />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.domain.label')">
            <UInput v-model="editedClient.domain" :placeholder="$t('master.clientEdit.fields.domain.placeholder')" />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.description.label')">
            <UTextarea
              v-model="editedClient.description"
              :placeholder="$t('master.clientEdit.fields.description.placeholder')"
              :maxLength="255"
              autoresize
            />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.logo.label')">
            <FormClientLogoUploader
              :imageUrl="editedClient.logoUrl"
              @upload="((editedClient.logoUrl = $event.url), (editedClient.optimizedUrl = $event.optimizedUrl))"
            />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.audience.label')">
            <UInput
              v-model="editedClient.audience"
              :placeholder="$t('master.clientEdit.fields.audience.placeholder')"
            />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.focus.label')">
            <UInput v-model="editedClient.focus" :placeholder="$t('master.clientEdit.fields.focus.placeholder')" />
          </UFormField>
          <div class="flex flex-col gap-3">
            <UFormField :label="$t('master.clientEdit.fields.keywords.label')">
              <UTextarea
                v-model="keywordsInput"
                :placeholder="$t('master.clientEdit.fields.keywords.placeholder')"
                autoresize
                @input="updateKeywords"
              />
            </UFormField>
            <span class="text-sm text-muted -mt-2">{{
              $t('master.clientEdit.fields.keywords.count', [editedClient.keywords.length])
            }}</span>
          </div>
          <UFormField :label="$t('master.clientEdit.fields.plan.label')">
            <USelectMenu
              v-model="editedClient.plan"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="[
                { label: 'Basic', value: 'BASIC' },
                { label: 'Pro', value: 'PRO' },
                { label: 'Premium', value: 'PREMIUM' },
                { label: 'Custom', value: 'CUSTOM' },
              ]"
            />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.generationFrequency.label')">
            <USelectMenu
              v-model="editedClient.generationFrequency"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="[
                { label: $t('master.clientEdit.fields.generationFrequency.options.NONE'), value: 'NONE' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.DAILY'), value: 'DAILY' },
                { label: $t('master.clientEdit.fields.generationFrequency.options.WEEKLY'), value: 'WEEKLY' },
              ]"
            />
          </UFormField>
          <UFormField :label="$t('master.clientEdit.fields.tokenLimit.label')">
            <UInputNumber
              v-model="editedClient.tokenLimit"
              :placeholder="$t('master.clientEdit.fields.tokenLimit.placeholder')"
              :min="0"
            />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end flex-shrink-0">
        <UButton color="neutral" variant="soft" size="lg" @click="close">{{
          $t('master.clientEdit.actions.close')
        }}</UButton>
        <UButton size="lg" :disabled="!isFormValid" @click="saveEdit">{{
          $t('master.clientEdit.actions.save')
        }}</UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { ClientSite } from '@zenstackhq/runtime/models'

const props = defineProps<{ client: ClientSite }>()

const open = defineModel<boolean>({ default: false })

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
        logoUrl: editedClient.value.logoUrl,
        keywords: editedClient.value.keywords.length ? editedClient.value.keywords : undefined,
      },
    })

    if (response?.clientSite) {
      toast.add({ color: 'success', title: t('master.clientEdit.messages.success') })
      emit('saved')
      open.value = false
    } else {
      throw new Error(t('master.clientEdit.messages.invalidResponse'))
    }
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: error?.data?.message || error.data?.message || t('master.clientEdit.messages.updateFailed'),
    })
  }
}
</script>
