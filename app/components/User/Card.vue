<template>
  <div class="relative group w-full flex">
    <div
      ref="card"
      class="bg-white dark:bg-neutral-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-4 w-full max-w-md"
    >
      <NuxtImg
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        alt="Profilový obrázek"
        class="w-12 h-12 rounded-full object-cover flex-shrink-0"
        width="48"
        height="48"
      />
      <Icon v-else name="mdi:account-circle-outline" class="w-12 h-12 text-gray-400 dark:text-gray-600 flex-shrink-0" />
      <div class="flex flex-col overflow-hidden">
        <span class="font-semibold text-gray-900 dark:text-white text-base truncate">
          {{ user.username }}
        </span>
        <p class="text-gray-500 dark:text-gray-400 text-sm truncate max-w-[200px]">
          {{ user.bio || 'Žádné bio' }}
        </p>
      </div>
    </div>

    <div
      v-if="isHovered"
      class="fixed w-80 z-10 hidden group-hover:flex flex-col bg-white dark:bg-neutral-900 p-5 rounded-xl shadow-xl border border-gray-200 dark:border-neutral-700"
      :style="{ top: `${y}px`, left: `${x - 320 - 16}px` }"
    >
      <div class="flex items-center gap-4">
        <NuxtImg
          v-if="user.avatarUrl"
          :src="user.avatarUrl"
          alt="Profilový obrázek"
          class="w-14 h-14 rounded-full object-cover"
          width="56"
          height="56"
        />
        <Icon v-else name="mdi:account-circle-outline" class="w-14 h-14 text-gray-400 dark:text-gray-600" />
        <div>
          <span class="font-semibold text-gray-900 dark:text-white text-lg">
            {{ user.username }}
          </span>
          <p class="text-gray-500 dark:text-gray-400 text-sm break-all">
            {{ user.email }}
          </p>
        </div>
      </div>

      <div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
        <p class="whitespace-pre-wrap break-words">
          {{ user.bio || 'Žádné bio' }}
        </p>
      </div>

      <div
        class="border-t border-gray-200 dark:border-gray-700 mt-3 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1"
      >
        <p>Přidal(a) se: {{ formatDate(user.createdAt) }}</p>
        <p>Naposledy přihlášen: {{ formatDate(user.lastLogin) }}</p>
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

const card = useTemplateRef('card')

const isHovered = useElementHover(card)

const { x, y } = useElementBounding(card)

const formatDate = (d?: string) => (d ? format(new Date(d), 'dd.MM.yyyy, HH:mm') : 'Nikdy')
</script>
