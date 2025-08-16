<template>
  <Modal v-model="open" title="Správa tagů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">Název tagu</span>
          <input
            v-model="newTag.name"
            placeholder="Název tagu"
            class="p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            @input="updateSlug"
          />
        </label>
        <button
          :disabled="!newTag.name"
          class="self-end px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
          @click="createTag"
        >
          Přidat tag
        </button>
      </div>

      <div class="flex flex-col gap-4 mt-4">
        <div v-if="tags.length" class="flex flex-wrap gap-2">
          <div
            v-for="t in tags"
            :key="t.id"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all duration-200 group dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            {{ t.name }}
            <button
              class="ml-1 w-5 h-5 flex items-center justify-center transition-colors duration-200 bg-transparent hover:bg-transparent border-none outline-none opacity-0 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
              @click="deleteTag(t.id, t.name)"
            >
              <Icon name="mdi:delete" class="w-4 h-4 text-red-500 hover:text-red-600 cursor-pointer" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-600 dark:text-gray-400">Žádné tagy.</p>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium bg-gray-100 hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 shadow-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
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

const updateSlug = () => {
  newTag.value.slug = slugify(newTag.value.name, {
    lower: true,
    strict: true,
    trim: true,
  })
}

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

const confirmDelete = async (name: string) => {
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
