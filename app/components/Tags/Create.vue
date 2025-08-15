<template>
  <Modal v-model="open" title="Správa tagů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název tagu</span>
          <input
            v-model="newTag.name"
            placeholder="Název tagu"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <button
          :disabled="!newTag.name"
          class="self-end px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          @click="createTag"
        >
          Přidat tag
        </button>
      </div>

      <div class="flex flex-col gap-4 max-h-64 overflow-y-auto">
        <div v-if="tags.length" class="flex flex-col divide-y divide-gray-200">
          <div v-for="t in tags" :key="t.id" class="flex items-center justify-between py-2 group">
            <span class="text-sm font-medium">{{ t.name }}</span>
            <button
              class="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-500 transition-all duration-300 hover:bg-red-100 hover:text-red-700 active:scale-90"
              @click="deleteTag(t.id, t.name)"
            >
              <Icon name="mdi:delete" class="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm">Žádné tagy.</p>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import Swal from 'sweetalert2'

const toast = useToast()

const open = defineModel<boolean>()

const { data: tags, refresh } = await useFetch('/api/tags', { default: () => [] })

const newTag = ref({ name: '', slug: '' })

const updateSlug = () =>
  (newTag.value.slug = slugify(newTag.value.name, {
    lower: true,
    strict: true,
    trim: true,
  }))

const createTag = async () => {
  if (!newTag.value.name) return

  updateSlug()

  try {
    await $fetch('/api/tags', {
      method: 'POST',
      body: {
        name: newTag.value.name,
        slug: newTag.value.slug,
      },
    })

    newTag.value = { name: '', slug: '' }

    await refresh()

    toast.success({ message: 'Tag byl úspěšně vytvořen.' })
  } catch (error: any) {
    toast.error({ message: `Chyba při vytváření tagu: ${error.data?.message}` })
  }
}

async function confirmDelete(name: string) {
  const result = await Swal.fire({
    title: `Smazat "${name}"?`,
    text: `Tímto vymažete štítek "${name}".`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, smazat',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })
  return result.isConfirmed
}

const deleteTag = async (id: string, name: string) => {
  const confirmed = await confirmDelete(name)
  if (!confirmed) return

  try {
    await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success({ message: 'Tag byl úspěšně smazán.' })
  } catch (error: any) {
    toast.error({ message: `Chyba při mazání tagu: ${error.data?.message}` })
  }
}
</script>
