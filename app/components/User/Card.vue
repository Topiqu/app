<template>
  <div class="relative group w-full flex dark:bg-neutral-900">
    <div
      ref="card"
      class="p-4 shadow-sm border border-gray-200 dark:border-neutral-700 flex items-center gap-4 w-full max-w-md sm:max-w-full transition-all"
    >
      <UserPicture :url="user?.avatarUrl" :name="user.username" />
      <div class="flex flex-col overflow-hidden min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-base truncate">
            {{ user.username }}
          </span>
          <span
            v-if="user.role === 'admin'"
            :class="[
              'text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1',
              data?.plan === 'PREMIUM'
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-md'
                : data?.plan === 'PRO'
                  ? 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white shadow-md'
                  : data?.plan === 'CUSTOM'
                    ? 'bg-gradient-to-r from-pink-400 to-pink-600 text-white shadow-md'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            ]"
          >
            <Icon
              v-if="data?.plan && ['PREMIUM', 'PRO', 'CUSTOM'].includes(data.plan)"
              :name="data.plan === 'PREMIUM' ? 'mdi:crown' : data.plan === 'PRO' ? 'mdi:star' : 'mdi:diamond'"
              class="w-4 h-4"
            />
            Admin
          </span>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-sm truncate max-w-[200px]">
          {{ user.bio || 'Žádné bio' }}
        </p>
      </div>
    </div>

    <div
      v-if="isHovered"
      class="absolute sm:fixed w-[90vw] sm:w-80 z-10 hidden group-hover:flex flex-col bg-white dark:bg-neutral-900 p-5 rounded-xl shadow-xl"
      :style="{ top: `${y}px`, left: `${Math.max(x - 320 - 16, 8)}px` }"
    >
      <div class="flex items-center gap-4">
        <UserPicture :url="user?.avatarUrl" :size="'lg'" :name="user?.username" />
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-gray-900 dark:text-white text-lg truncate">
              {{ user.username }}
            </span>
            <span
              v-if="user.role === 'admin'"
              :class="[
                'text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1',
                data?.plan === 'PREMIUM'
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-md'
                  : data?.plan === 'PRO'
                    ? 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white shadow-md'
                    : data?.plan === 'CUSTOM'
                      ? 'bg-gradient-to-r from-pink-400 to-pink-600 text-white shadow-md'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
              ]"
            >
              <Icon
                v-if="data?.plan && ['PREMIUM', 'PRO', 'CUSTOM'].includes(data.plan)"
                :name="data.plan === 'PREMIUM' ? 'mdi:crown' : data.plan === 'PRO' ? 'mdi:star' : 'mdi:diamond'"
                class="w-4 h-4"
              />
              Admin
            </span>
          </div>
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
        class="mt-3 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1 border-t border-gray-200 dark:border-gray-700"
      >
        <p v-if="user.role === 'admin'">Administrátor ve: {{ data?.name || 'Není přiřazen' }}</p>
        <p>Přidal(a) se: {{ formatDate(user.createdAt) }}</p>
        <p>Naposledy přihlášen: {{ formatDate(user.lastLogin) }}</p>
        <p>Komentáře: {{ user.commentsCount ?? 0 }}</p>
        <p>Sleduje: {{ user.followers ?? 0 }}</p>
        <p v-if="user.following > 0">Sledující: {{ user.following ?? 0 }}</p>
        <div class="flex items-center gap-2">
          <Icon name="mdi:thumb-up" class="w-4 h-4 text-green-500 dark:text-green-400" />
          <span>{{ user.likesCount ?? 0 }}</span>
          <Icon name="mdi:thumb-down" class="w-4 h-4 text-red-500 dark:text-red-400" />
          <span>{{ user.dislikesCount ?? 0 }}</span>
        </div>
      </div>
    </div>
  </div>
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

const { data } = await useFetch(`/api/clients/${props.user.id}/by-userid`)
const card = useTemplateRef('card')
const isHovered = useElementHover(card)
const { x, y } = useElementBounding(card)
</script>
