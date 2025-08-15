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
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
        >
          Zavřít
        </button>
        <button
          :disabled="!editedClient.name || !editedClient.subdomain"
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveEdit"
        >
          Uložit změny
        </button>
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

const editedClient = ref({
  id: props.client.id,
  name: props.client.name,
  subdomain: props.client.subdomain,
  plan: props.client.plan,
  generationFrequency: props.client.generationFrequency,
  tokenLimit: props.client.tokenLimit,
})

const saveEdit = async () => {
  if (!editedClient.value.name || !editedClient.value.subdomain) return

  try {
    const response = await $fetch(`/api/clients/${editedClient.value.id}`, {
      method: 'PATCH',
      body: editedClient.value,
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
      message: error?.data?.message || error.message || 'Nepodařilo se aktualizovat klienta',
    })
  }
}
</script>
