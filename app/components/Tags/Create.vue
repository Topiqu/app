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
            class="p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-300 shadow-sm hover:shadow-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:focus:ring-blue-500 dark:focus:border-blue-500"
            @input="updateSlug"
          />
        </label>
        <button
          :disabled="!newTag.name"
          class="self-end px-6 py-3 rounded-xl text-base font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800"
          @click="createTag"
        >
          Přidat tag
        </button>
      </div>

      <div class="flex flex-col gap-4 mt-4">
        <div class="relative">
          <Icon
            name="mdi:magnify"
            class="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-400 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            placeholder="Vyhledat tag..."
            class="pl-12 pr-4 py-3 rounded-full text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-300 shadow-sm hover:shadow-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:focus:ring-blue-500 dark:focus:border-blue-500"
          />
        </div>
        <div v-if="filteredTags.length" class="flex flex-wrap gap-3">
          <div
            v-for="t in filteredTags"
            :key="t.id"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-50 transition-all duration-300 group dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            {{ t.name }}
            <button
              class="ml-2 w-5 h-5 flex items-center justify-center transition-colors duration-300 bg-transparent hover:bg-transparent border-none outline-none opacity-0 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
              @click="deleteTag(t.id, t.name)"
            >
              <Icon
                name="mdi:delete"
                class="w-4 h-4 text-red-500 hover:text-red-600 cursor-pointer dark:text-red-400 dark:hover:text-red-300"
              />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-600 dark:text-gray-400">Žádné tagy nenalezeny.</p>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium bg-gray-50 hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
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
let newTag = reactive({ name: '', slug: '' })
const searchQuery = shallowRef('')

const filteredTags = computed(() =>
  tags.value.filter((t) => t.name.toLowerCase().includes(searchQuery.value.toLowerCase())),
)

const updateSlug = () => {
  newTag.slug = slugify(newTag.name, {
    lower: true,
    strict: true,
    trim: true,
  })
}

const createTag = async () => {
  if (!newTag.name) return
  updateSlug()
  try {
    await $fetch('/api/tags', {
      method: 'POST',
      body: {
        name: newTag.name,
        slug: newTag.slug,
      },
    })
    newTag = { name: '', slug: '' }
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
