<template>
  <UPopover mode="hover" :content="{ side: 'left', align: 'start' }">
    <UCard class="w-full max-w-md sm:max-w-full">
      <div class="flex items-center gap-3">
        <UserPicture :url="user.avatarUrl" :name="user.username" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-highlighted">{{ user.username }}</p>
          <p class="truncate text-sm text-muted">{{ user.bio || $t('articles.userMenu.noBio') }}</p>
        </div>
        <UBadge v-if="user.role === 'admin'" :color="planColor" variant="soft" :icon="planIcon">
          {{ $t('master.userEdit.roles.admin') }}
        </UBadge>
      </div>
    </UCard>

    <template #content>
      <UCard class="w-[90vw] sm:w-80">
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <UserPicture :url="user.avatarUrl" :name="user.username" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-highlighted">{{ user.username }}</p>
              <p class="truncate text-sm text-muted">{{ user.email }}</p>
            </div>
            <UBadge v-if="user.role === 'admin'" :color="planColor" variant="soft" :icon="planIcon">
              {{ $t('master.userEdit.roles.admin') }}
            </UBadge>
          </div>
          <p class="whitespace-pre-wrap break-words text-sm text-muted">
            {{ user.bio || $t('articles.userMenu.noBio') }}
          </p>
          <USeparator />
          <div class="space-y-1 text-xs text-muted">
            <p v-if="user.role === 'admin'">
              {{ $t('articles.userMenu.adminIn', [data?.name || $t('articles.userMenu.noClientAssigned')]) }}
            </p>
            <p>{{ $t('common.user.joined', [formatDate(user.createdAt)]) }}</p>
            <p>{{ $t('profile.lastLogin', [formatDate(user.lastLogin)]) }}</p>
            <p>{{ $t('articles.comments.title') + ': ' }} {{ user.commentsCount ?? 0 }}</p>
            <p>{{ $t('profile.followers') + ': ' }} {{ user.followers ?? 0 }}</p>
            <p v-if="user.following > 0">{{ $t('profile.following', [user.following ?? 0]) }}</p>
          </div>
          <div class="flex gap-2">
            <UBadge color="success" variant="soft" icon="i-mdi-thumb-up">{{ user.likesCount ?? 0 }}</UBadge>
            <UBadge color="error" variant="soft" icon="i-mdi-thumb-down">{{ user.dislikesCount ?? 0 }}</UBadge>
          </div>
        </div>
      </UCard>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'

const props = defineProps<{
  user: {
    id: string
    username: string
    email: string
    bio?: string
    createdAt: string
    avatarUrl?: string
    lastLogin?: string
    commentsCount: number
    likesCount: number
    dislikesCount: number
    followers: number
    following: number
    role: string
  }
}>()

const { data } = await useFetch(() => `/api/clients/${props.user.id}/by-userid`, {
  default: () => null,
  immediate: props.user.role === 'admin',
})
const planColor = computed(() =>
  data.value?.plan === 'PREMIUM'
    ? 'warning'
    : data.value?.plan === 'PRO'
      ? 'primary'
      : data.value?.plan === 'CUSTOM'
        ? 'error'
        : 'info',
)
const planIcon = computed(() =>
  data.value?.plan === 'PREMIUM'
    ? 'i-mdi-crown'
    : data.value?.plan === 'PRO'
      ? 'i-mdi-star'
      : data.value?.plan === 'CUSTOM'
        ? 'i-mdi-diamond'
        : undefined,
)
</script>
