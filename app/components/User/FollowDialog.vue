<template>
  <Modal v-model="open" :title="type === 'followers' ? $t('profile.followers') : $t('profile.following')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
        <p v-if="pending" class="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ $t('common.loading') }}
        </p>
        <div v-else-if="error" class="rounded-xl bg-red-50 p-4 text-center dark:bg-red-900/20">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error?.message || $t('common.error') }}</p>
        </div>
        <p v-else-if="!data?.length" class="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ $t('common.noResults') }}
        </p>
        <ul v-else class="grid gap-2">
          <li
            v-for="u in data"
            :key="u.id"
            class="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
          >
            <UserPicture :url="u?.avatarUrl" :name="u?.username" />
            <div class="min-w-0">
              <NuxtLink
                :to="localePath({ name: 'autor-name', params: { name: u?.username } })"
                class="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
              >
                {{ u.username }}
              </NuxtLink>
              <p v-if="u.bio" class="line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{{ u.bio }}</p>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
const localePath = useLocalePath()

const open = defineModel<boolean>()

const { type } = defineProps<{ type: 'followers' | 'followed' }>()

const { data, pending, error } = await useFetch(() => `/api/follows/${type}`)
</script>
