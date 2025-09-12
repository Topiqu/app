<template>
  <Modal v-model="open" :title="type === 'followers' ? 'Sledující' : 'Sledování'">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
        <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání...</div>
        <div v-else-if="error" class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p class="text-red-600 dark:text-red-400">{{ error?.message || 'Chyba při načítání' }}</p>
        </div>
        <div v-else-if="!data?.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
          Žádní {{ type === 'followers' ? 'sledující' : 'uživatelé nejsou sledováni' }}.
        </div>
        <div v-else class="grid gap-4">
          <div
            v-for="u in data"
            :key="u.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-900"
          >
            <UserPicture :url="u?.avatarUrl" :name="u?.username" />
            <div>
              <NuxtLinkLocale
                :to="localePath({ name: 'autor-name', params: { name: u?.username } })"
                class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {{ u.username }}
              </NuxtLinkLocale>
              <p v-if="u.bio" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ u.bio }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
const localePath = useLocalePath()

const open = defineModel<boolean>()

const props = defineProps<{ type: 'followers' | 'followed' }>()

const { data, pending, error } = await useFetch(() => `/api/follows/${props.type}`)
</script>
