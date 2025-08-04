<template>
  <Dialog as="div" class="relative z-[1000]" @close="confirmClose">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-200"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" />
    </TransitionChild>
    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-95"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-150"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-95"
      >
        <DialogPanel
          class="w-full max-w-xl p-8 sm:p-10 rounded-3xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
        >
          <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
            <DialogTitle class="text-2xl font-semibold">Vaše preference</DialogTitle>
            <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání dat...</div>
            <div v-else class="flex flex-col gap-6 mt-6">
              <label class="flex flex-col gap-2">
                <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                  >Fokus</span
                >
                <input
                  v-model="form.focus"
                  placeholder="Fokus (např. objektivní žurnalistika v gamingu, důraz na unreal engine)"
                  class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
                />
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                  >Cílová skupina</span
                >
                <input
                  v-model="form.audience"
                  placeholder="Cílová skupina (např. mladí dospělí, profesionálové)"
                  class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
                />
              </label>
              <label class="flex flex-col gap-2">
                <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                  >Klíčová slova</span
                >
                <input
                  v-model="keywordsInput"
                  placeholder="Klíčová slova (oddělená čárkami)"
                  class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
                  @input="updateKeywords"
                />
                <span class="text-sm text-gray-500 dark:text-gray-400">Slova: {{ form.keywords.length }}</span>
              </label>
            </div>
          </div>
          <div class="flex gap-4 justify-end mt-6 flex-shrink-0 pt-4 border-t border-gray-300 dark:border-gray-600">
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              @click="confirmClose"
            >
              Zrušit
            </button>
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-md bg-blue-600 dark:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="savePreferences"
            >
              Uložit
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

const emit = defineEmits(['close'])
const toast = useToast()
const { data: auth } = useAuth()

const init = { focus: '', audience: '', keywords: [] as string[] }
const form = ref<typeof init>(init)
const keywordsInput = ref('')

const {
  data: client,
  pending,
  refresh,
} = await useFetch(`/api/clients/${auth.value?.user.clientSiteId}`, {
  default: () => null,
})

if (client.value) {
  form.value.focus = client.value.focus || ''
  form.value.audience = client.value.audience || ''
  form.value.keywords = (client.value.keywords as string[] | undefined) || []
  keywordsInput.value = form.value.keywords.join(', ')
}

const updateKeywords = () => {
  form.value.keywords = keywordsInput.value
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

const savePreferences = async () => {
  if (!auth.value?.user.clientSiteId) return toast.error({ message: 'Chybí ID klienta' })
  try {
    await $fetch(`/api/clients/${auth.value.user.clientSiteId}`, {
      method: 'PATCH',
      body: {
        focus: form.value.focus || undefined,
        audience: form.value.audience || undefined,
        keywords: form.value.keywords.length ? form.value.keywords : undefined,
      },
    })
    toast.success({ message: 'Nastavení uloženo' })
    await refresh()
    emit('close')
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Uložení selhalo' })
  }
}

const confirmClose = async () => {
  if (
    form.value.focus !== (client.value?.focus || '') ||
    form.value.audience !== (client.value?.audience || '') ||
    JSON.stringify(form.value.keywords) !== JSON.stringify((client.value?.keywords as string[] | undefined) || [])
  ) {
    const r = await Swal.fire({
      title: 'Zavřít dialog?',
      text: 'Neuložené změny budou ztraceny. Opravdu chcete pokračovat?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ano, zavřít',
      cancelButtonText: 'Ne',
      confirmButtonColor: '#ef4444',
    })
    if (r.isConfirmed) emit('close')
  } else {
    emit('close')
  }
}
</script>
