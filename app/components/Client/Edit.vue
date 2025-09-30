<template>
  <Modal v-model="open" title="Úprava klienta">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex-1 overflow-y-auto pr-4">
        <div class="flex flex-col gap-6">
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název klienta</span>
            <input
              v-model="editedClient.name"
              placeholder="Název klienta"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Subdoména</span>
            <input
              v-model="editedClient.subdomain"
              placeholder="Subdoména"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Popis</span>
            <textarea
              v-model="editedClient.description"
              placeholder="Popis klienta (max. 255 znaků)"
              maxlength="255"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md resize-y min-h-[100px]"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Logo klienta</span>
            <FileUploader
              :imageUrl="editedClient.logoUrl"
              type="client-logo"
              @upload="editedClient.logoUrl = $event.url"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Cílová skupina</span>
            <input
              v-model="editedClient.audience"
              placeholder="Cílová skupina (např. mladí profesionálové)"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Focus firmy</span>
            <input
              v-model="editedClient.focus"
              placeholder="Focus firmy (např. technologie, marketing)"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Klíčová slova</span>
            <textarea
              v-model="keywordsInput"
              placeholder="Klíčová slova (oddělená čárkou, např. seo, marketing, tech)"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md resize-y min-h-[100px]"
              @input="updateKeywords"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400">Slova: {{ editedClient.keywords.length }}</span>
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Plán</span>
            <select
              v-model="editedClient.plan"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <option value="BASIC">Basic</option>
              <option value="PRO">Pro</option>
              <option value="PREMIUM">Premium</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Frekvence generování</span>
            <select
              v-model="editedClient.generationFrequency"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <option value="NONE">Žádná</option>
              <option value="DAILY">Denní</option>
              <option value="WEEKLY">Týdenní</option>
            </select>
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Limit tokenů</span>
            <input
              v-model.number="editedClient.tokenLimit"
              type="number"
              placeholder="Limit tokenů"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              min="0"
            />
          </label>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end flex-shrink-0">
        <Button variant="neutral" size="lg" @click="close">Zavřít</Button>
        <Button size="lg" :disabled="!isFormValid" @click="saveEdit">Uložit změny</Button>
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

const normalizeKeywords = (val: unknown): string[] => {
  return Array.isArray(val) ? val : []
}

const keywordsInput = ref(normalizeKeywords(props.client.keywords).join(', '))

const editedClient = ref({
  id: props.client.id,
  name: props.client.name,
  subdomain: props.client.subdomain,
  plan: props.client.plan,
  generationFrequency: props.client.generationFrequency,
  tokenLimit: props.client.tokenLimit,
  description: props.client.description || '',
  logoUrl: props.client.logoUrl || '',
  audience: props.client.audience || '',
  focus: props.client.focus || '',
  keywords: normalizeKeywords(props.client.keywords),
})

const isFormValid = computed(() => {
  const { name, subdomain } = editedClient.value
  return !!name && !!subdomain
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
    const response = await $fetch(`/api/clients/${editedClient.value.id}`, {
      method: 'PATCH',
      body: {
        ...editedClient.value,
        keywords: editedClient.value.keywords.length ? editedClient.value.keywords : undefined,
      },
    })

    if (response?.clientSite) {
      toast.success({ message: 'Klient úspěšně aktualizován.' })
      emit('saved')
      open.value = false
    } else {
      throw new Error('Neplatná odpověď serveru')
    }
  } catch (error: any) {
    toast.error({
      message: error?.data?.message || error.data?.message || 'Nepodařilo se aktualizovat klienta',
    })
  }
}
</script>
