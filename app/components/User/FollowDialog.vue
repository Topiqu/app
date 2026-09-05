<template>
  <UModal v-model:open="open" :title="type === 'followers' ? $t('profile.followers') : $t('profile.following')">
    <slot :open="open" />

    <template #body>
      <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
        <UProgress v-if="pending" animation="carousel" />
        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          :description="error?.message || $t('common.errors.failedToLoad')"
        />
        <UEmpty
          v-else-if="!data?.length"
          icon="mdi:account-off-outline"
          :description="type === 'followers' ? $t('profile.noFollowers') : $t('profile.noFollowing')"
        />
        <div v-else class="grid gap-4">
          <UPageCard
            v-for="u in data"
            :key="u.id"
            :to="localePath({ name: 'autor-name', params: { name: u?.username } })"
          >
            <div class="flex items-center gap-3">
              <UserPicture :url="u.avatarUrl" :name="u.username" />
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">{{ u.username }}</p>
                <p v-if="u.bio" class="line-clamp-2 text-sm text-muted">{{ u.bio }}</p>
              </div>
            </div>
          </UPageCard>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
const localePath = useLocalePath()

const open = defineModel<boolean>({ default: false })

const { type } = defineProps<{ type: 'followers' | 'followed' }>()

const { data, pending, error } = await useFetch(() => `/api/follows/${type}`)
</script>
