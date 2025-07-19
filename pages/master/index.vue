<template>
  <div class="space-y-6 max-w-xl mx-auto mt-10">
    <form class="space-y-3" @submit.prevent="createClient">
      <input
        v-model="form.name"
        type="text"
        placeholder="Název"
        class="w-full border px-3 py-2 rounded"
      />
      <input
        v-model="form.subdomain"
        type="text"
        placeholder="Subdoména"
        class="w-full border px-3 py-2 rounded"
      />
      <button
        type="submit"
        class="bg-black text-white px-4 py-2 rounded hover:bg-neutral-800"
      >
        Přidat klienta
      </button>
    </form>

    <ClientTable @refresh="refresh" />
  </div>
</template>

<script lang="ts" setup>
const form = ref({ name: '', subdomain: '' })
const toast = useToast()

const { refresh } = await useFetch('/api/clients', {
  lazy: true,
  server: false,
})

const createClient = async () => {
  try {
    await $fetch('/api/clients', {
      method: 'POST',
      body: form.value,
    })
    toast.success({ message: 'Klient přidán' })
    form.value = { name: '', subdomain: '' }
    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Vytvoření selhalo' })
  }
}
</script>
