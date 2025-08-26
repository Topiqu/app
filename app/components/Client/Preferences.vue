<template>
  <Modal v-model="open" title="Vaše preference" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #close>
      <LazyClientHint v-slot="{ open: clientHintOpen }" hydrateOnInteraction>
        <button
          class="p-2 rounded-full bg-transparent hover:bg-transparent border-none outline-none cursor-pointer"
          title="Vysvětlení preferencí"
          @click="clientHintOpen.value = true"
        >
          <Icon name="mdi:information-outline" class="w-6 h-6" />
        </button>
      </LazyClientHint>
    </template>

    <template #content>
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání dat...</div>
      <div v-else class="flex flex-col gap-6 mt-6">
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Logo firmy</span>
          <FileUploader :imageUrl="client?.logoUrl" type="client-logo" @upload="onLogoUpload" />
          <span class="text-xs text-gray-500 dark:text-gray-400"
            >PNG, JPEG, WebP nebo SVG, min. 512x512px, max. 2 MB</span
          >
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
            >Popisek firmy</span
          >
          <textarea
            v-model="form.description"
            placeholder="Popisek firmy (např. Vaše mise nebo slogan)"
            maxlength="255"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300 resize-none h-24"
          ></textarea>
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Fokus</span>
          <input
            v-model="form.focus"
            placeholder="Fokus (např. objektivní žurnalistika v gamingu, důraz na unreal engine)"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
          />
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
            >Cílová skupina</span
          >
          <input
            v-model="form.audience"
            placeholder="Cílová skupina (např. mladí dospělí, profesionálové)"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/70 transition-all duration-300"
          />
        </label>
        <label v-if="auth?.user?.plan !== 'BASIC'" class="flex flex-col gap-2">
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
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0 pt-4 border-t border-gray-300 dark:border-gray-600">
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          @click="close"
        >
          Zrušit
        </button>
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 text-white dark:text-black shadow-md bg-blue-600 dark:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="savePreferences"
        >
          Uložit
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'

const toast = useToast()
const { data: auth } = useAuth()
const open = defineModel<boolean>()
const init = { focus: '', audience: '', keywords: [] as string[], description: '', logoUrl: '' }
const form = ref<typeof init>(init)
const keywordsInput = shallowRef<string>('')

const {
  data: client,
  pending,
  refresh,
} = await useFetch(`/api/clients/${auth.value?.user.clientSiteId}`, { default: () => null })

if (client.value) {
  form.value.focus = client.value.focus || ''
  form.value.audience = client.value.audience || ''
  form.value.keywords = (client.value.keywords as string[] | undefined) || []
  form.value.description = client.value.description || ''
  form.value.logoUrl = client.value.logoUrl || ''
  keywordsInput.value = form.value.keywords.join(', ')
}

const onLogoUpload = ({ url }: { url: string }) => {
  form.value.logoUrl = url
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
        description: form.value.description || undefined,
        logoUrl: form.value.logoUrl || undefined,
      },
    })
    toast.success({ message: 'Nastavení uloženo' })
    await refresh()
    open.value = false
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Uložení selhalo' })
  }
}

const confirmClose = async () => {
  if (
    form.value.focus !== (client.value?.focus || '') ||
    form.value.audience !== (client.value?.audience || '') ||
    form.value.description !== (client.value?.description || '') ||
    form.value.logoUrl !== (client.value?.logoUrl || '') ||
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
    if (r.isConfirmed) open.value = false
  } else {
    open.value = false
  }
}
</script>
