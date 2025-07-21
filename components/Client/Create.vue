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
          class="w-full max-w-lg bg-white p-10 rounded-3xl shadow-2xl border backdrop-blur-sm flex flex-col max-h-[80vh]"
        >
          <div class="flex-1 overflow-y-auto pr-4">
            <DialogTitle class="text-xl font-bold text-gray-900">
              Správa klientů
            </DialogTitle>

            <div class="flex flex-col gap-6">
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Název klienta</span
                >
                <input
                  v-model="newClient.name"
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
                  v-model="newClient.subdomain"
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
                  v-model="newClient.plan"
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
                  v-model="newClient.generationFrequency"
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
                  v-model.number="newClient.tokenLimit"
                  type="number"
                  placeholder="Limit tokenů"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                  min="0"
                />
              </label>
            </div>
          </div>
          <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
              @click="$emit('close')"
            >
              Zavřít
            </button>
            <button
              class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              @click="createClient"
            >
              Přidat klienta
            </button>
          </div>

          <div class="flex flex-col gap-4 max-h-64 overflow-y-auto mt-6">
            <div
              v-if="fetchedClients?.length"
              class="flex flex-col divide-y divide-gray-200"
            >
              <div
                v-for="c in fetchedClients"
                :key="c.id"
                class="flex items-center justify-between py-2 group"
              >
                <span class="text-gray-800 text-sm font-medium">{{
                  c.name
                }}</span>
                <button
                  class="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 transition-all duration-300 hover:bg-red-100 hover:text-red-700 active:scale-90"
                  @click="deleteClient(c.id, c.name)"
                >
                  <Icon name="mdi:delete" class="w-5 h-5" />
                </button>
              </div>
            </div>
            <p v-else class="text-gray-600 text-sm">Žádní klienti.</p>
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
import Swal from 'sweetalert2'

defineEmits(['close'])

const newClient = {
  name: '',
  subdomain: '',
  plan: 'BASIC',
  generationFrequency: 'NONE',
  tokenLimit: 0,
}

const toast = useToast()
const { data: fetchedClients, refresh } = useFetch('/api/clients', {
  default: () => [],
})

const createClient = async () => {
  if (!newClient.name || !newClient.subdomain) return
  try {
    await useFetch('/api/clients', {
      method: 'POST',
      body: newClient,
    })
    toast.success({ message: 'Klient byl úspěšně přidán' })
    newClient.name = ''
    newClient.subdomain = ''
    newClient.plan = 'BASIC'
    newClient.generationFrequency = 'NONE'
    newClient.tokenLimit = 0
    await refresh()
  } catch (error: any) {
    toast.error({
      message: error.data?.message || 'Nepodařilo se přidat klienta',
    })
  }
}

async function confirmDelete(name: string) {
  const result = await Swal.fire({
    title: `Smazat "${name}"?`,
    text: `Tímto vymažete klienta "${name}".`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, smazat',
    cancelButtonText: 'Ne',
    background: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
  })
  return result.isConfirmed
}

const deleteClient = async (id: string, name: string) => {
  const confirmed = await confirmDelete(name)
  if (!confirmed) return

  try {
    await useFetch(`/api/clients/${id}`, { method: 'DELETE' })
    toast.success({ message: 'Klient byl úspěšně smazán' })
    await refresh()
  } catch (error: any) {
    toast.error({
      message: error.data?.message || 'Nepodařilo se smazat klienta',
    })
  }
}
</script>
