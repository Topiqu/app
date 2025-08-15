<template>
  <Modal v-model="open" title="Správa klientů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název klienta</span>
          <input
            v-model="newClient.name"
            placeholder="Název klienta"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Email</span>
          <input
            v-model="newClient.email"
            placeholder="Email"
            type="email"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Uživatelské jméno</span>
          <input
            v-model="newClient.username"
            placeholder="Uživatelské jméno"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Heslo</span>
          <input
            v-model="newClient.password"
            placeholder="Heslo (nechte prázdné pro automatické generování)"
            type="password"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Subdoména</span>
          <input
            v-model="newClient.subdomain"
            placeholder="Subdoména"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Plán</span>
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
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Frekvence generování</span>
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
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Limit tokenů</span>
          <input
            v-model.number="newClient.tokenLimit"
            type="number"
            placeholder="Limit tokenů"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            min="0"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Focus firmy</span>
          <input
            v-model="newClient.focus"
            placeholder="Focus firmy (např. technologie, marketing)"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Klíčová slova</span>
          <textarea
            v-model="newClient.keywords"
            placeholder="Klíčová slova (oddělená čárkou, např. seo, marketing, tech)"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          />
        </label>
      </div>

      <div class="flex flex-col gap-4 mt-6">
        <div v-if="fetchedClients?.length" class="flex flex-col divide-y divide-gray-200">
          <div v-for="c in fetchedClients" :key="c.id" class="flex items-center justify-between py-2 group">
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{ c.name }}</span>
              <span v-if="c.focus" class="text-gray-400 text-xs">Focus: {{ c.focus }}</span>
              <span v-if="c.keywords" class="text-gray-400 text-xs"
                >Klíčová slova:
                {{
                  Array.isArray(c.keywords) ? c.keywords.join(', ') : typeof c.keywords === 'string' ? c.keywords : ''
                }}</span
              >
            </div>
            <button
              class="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 transition-all duration-300 hover:bg-red-100 hover:text-red-700 active:scale-90"
              @click="deleteClient(c.id, c.name)"
            >
              <Icon name="mdi:delete" class="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
        <p v-else class="text-gray-600 text-sm">Žádní klienti.</p>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
          @click="close"
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
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'

const { emitClientCreated } = useClientEvent()

const open = defineModel<boolean>()

const newClient = ref({
  name: '',
  email: '',
  username: '',
  password: '',
  subdomain: '',
  plan: 'BASIC',
  generationFrequency: 'NONE',
  tokenLimit: 0,
  focus: '',
  keywords: '',
})

const toast = useToast()
const { data: fetchedClients, refresh } = useFetch('/api/clients', {
  default: () => [],
})

const createClient = async () => {
  if (!newClient.value.name || !newClient.value.subdomain || !newClient.value.email) return
  try {
    await $fetch('/api/clients', {
      method: 'POST',
      body: newClient.value,
    })
    toast.success({ message: 'Klient byl úspěšně přidán' })
    emitClientCreated()
    open.value = false
  } catch (e: any) {
    toast.error({
      message: e.data?.message || 'Nepodařilo se přidat klienta',
    })
  }
}

async function confirmDelete(name: string) {
  const r = await Swal.fire({
    title: `Smazat "${name}"?`,
    text: `Tímto vymažete klienta "${name}" trvale.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, smazat',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })
  return r.isConfirmed
}

const deleteClient = async (id: string, name: string) => {
  if (!(await confirmDelete(name))) return
  try {
    await $fetch(`/api/clients/${id}?hard=true`, { method: 'DELETE' })
    toast.success({ message: 'Klient byl úspěšně smazán' })
    await refresh()
  } catch (e: any) {
    toast.error({
      message: e.data?.message || 'Nepodařilo se smazat klienta',
    })
  }
}
</script>
