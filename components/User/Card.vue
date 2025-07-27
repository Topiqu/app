<template>
  <div class="relative group w-full">
    <div
      class="bg-white dark:bg-neutral-900 p-3 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-3"
    >
      <NuxtImg
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        alt="Profilový obrázek"
        class="w-10 h-10 rounded-full object-cover flex-shrink-0"
        width="40"
        height="40"
      />
      <Icon
        v-else
        name="mdi:account-circle-outline"
        class="w-10 h-10 text-gray-400 dark:text-gray-600 flex-shrink-0"
      />
      <div class="flex flex-col overflow-hidden">
        <span
          class="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate"
        >
          {{ user.username }}
        </span>
        <p
          class="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[200px]"
        >
          {{ user.bio || 'Žádné bio' }}
        </p>
      </div>
    </div>

    <div
      class="absolute z-10 hidden group-hover:block bg-white dark:bg-neutral-900 p-4 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700 w-72 mt-2"
    >
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <NuxtImg
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            alt="Profilový obrázek"
            class="w-12 h-12 rounded-full object-cover"
            width="48"
            height="48"
          />
          <Icon
            v-else
            name="mdi:account-circle-outline"
            class="w-12 h-12 text-gray-400 dark:text-gray-600"
          />
          <div>
            <span
              class="font-semibold text-gray-800 dark:text-gray-100 text-base"
            >
              {{ user.username }}
            </span>
            <p class="text-gray-500 dark:text-gray-400 text-xs break-all">
              {{ user.email }}
            </p>
          </div>
        </div>

        <div class="text-sm text-gray-600 dark:text-gray-300">
          <p class="whitespace-pre-wrap break-words">
            {{ user.bio || 'Žádné bio' }}
          </p>
        </div>

        <div
          class="border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1"
        >
          <p>Vytvořen: {{ formatDate(user.createdAt) }}</p>
          <p>Poslední přihlášení: {{ formatDate(user.lastLogin) }}</p>
          <p>Komentáře: {{ user.commentsCount ?? 0 }}</p>
          <div class="flex items-center gap-2">
            <Icon name="mdi:thumb-up" class="w-4 h-4 text-green-500" />
            <span>{{ user.likesCount ?? 0 }}</span>
            <Icon name="mdi:thumb-down" class="w-4 h-4 text-red-500" />
            <span>{{ user.dislikesCount ?? 0 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'

defineProps<{
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
  }
}>()

const formatDate = (d?: string) =>
  d ? format(new Date(d), 'dd.MM.yyyy, HH:mm') : 'Nikdy'
</script>
