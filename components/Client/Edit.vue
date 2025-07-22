<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />
    </TransitionChild>
    <div class="fixed inset-0 flex items-center justify-center p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-90"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-100"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-90"
      >
        <DialogPanel
          class="w-full max-w-lg bg-white p-10 rounded-3xl shadow-2xl flex flex-col gap-8 border backdrop-blur-sm max-h-[80vh]"
        >
          <DialogTitle class="text-xl font-bold text-gray-900">
            Úprava klienta
          </DialogTitle>
          <div class="flex-1 overflow-y-auto pr-4">
            <div class="flex flex-col gap-6">
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Název klienta</span
                >
                <input
                  v-model="editedClient.name"
                  placeholder="Název klienta"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                />
              </label>
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Subdoména</span
                >
                <input
                  v-model="editedClient.subdomain"
                  placeholder="Subdoména"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                />
              </label>
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Plán</span
                >
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
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Frekvence generování</span
                >
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
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Limit tokenů</span
                >
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
          <div class="flex gap-4 justify-end flex-shrink-0">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
              @click="$emit('close')"
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
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
} from '@headlessui/vue'
import type { ClientSite } from '@zenstackhq/runtime/models'

const props = defineProps<{
  client: ClientSite
}>()
const emit = defineEmits(['close', 'saved'])

const editedClient = ref({
  id: props.client.id,
  name: props.client.name,
  subdomain: props.client.subdomain,
  plan: props.client.plan,
  generationFrequency: props.client.generationFrequency,
  tokenLimit: props.client.tokenLimit,
})
const toast = useToast()

const saveEdit = async () => {
  if (!editedClient.value.name || !editedClient.value.subdomain) return

  try {
    const response = await useFetch(`/api/clients/${editedClient.value.id}`, {
      method: 'PATCH',
      body: editedClient.value,
    })
    if (response.data?.value) {
      toast.success({ message: 'Klient úspěšně aktualizován.' })
      emit('saved')
      emit('close')
    } else {
      throw new Error('Neplatná odpověď serveru')
    }
  } catch (error: any) {
    toast.error({
      message: error.data?.message || 'Nepodařilo se aktualizovat klienta',
    })
  }
}
</script>
