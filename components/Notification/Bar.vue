<template>
  <div class="fixed top-4 right-4 z-[1000]">
    <div class="relative">
      <Icon
        name="mdi:bell-outline"
        class="w-6 h-6 text-gray-600 cursor-pointer hover:text-blue-600 transition"
        @click.stop="toggleNotifications"
      />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-white shadow-sm"
      >
        {{ unreadCount }}
      </span>

      <div
        v-if="showNotifications"
        ref="notifDropdown"
        class="absolute right-0 mt-3 w-80 max-w-[90vw] max-h-96 bg-white border border-gray-200 rounded-xl shadow-lg overflow-y-auto z-50 p-4"
      >
        <div v-if="notifications.length" class="space-y-3">
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="p-2 rounded-lg transition bg-opacity-50"
            :class="notification.isRead ? 'bg-gray-50' : 'bg-blue-50'"
          >
            <p class="text-sm text-gray-800">{{ notification.message }}</p>
            <p class="text-xs text-gray-400">
              {{ formatDate(notification.createdAt) }}
            </p>
            <NuxtLink
              v-if="notification.article"
              :to="`/articles/${notification.article.slug}`"
              class="text-xs text-blue-600 hover:underline font-medium"
            >
              {{ notification.article.title }}
            </NuxtLink>
          </div>
        </div>
        <p v-else class="text-sm text-gray-600 text-center">
          Žádné nové notifikace.
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { format } from 'date-fns'

const { data: auth } = useAuth()
const showNotifications = ref(false)

const { data: notificationsData, refresh } = await useFetch(
  '/api/notifications',
  {
    default: () => ({ notifications: [], count: 0, unreadCount: 0 }),
    key: `notifications-${auth.value?.user.id}`,
  },
)

const notifications = computed(
  () => notificationsData.value?.notifications || [],
)
const unreadCount = computed(() => notificationsData.value?.unreadCount || 0)

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) refresh()
}

const formatDate = (d: string) => format(new Date(d), 'dd.MM.yyyy, HH:mm')

const notifDropdown = ref(null)
onClickOutside(notifDropdown, () => {
  showNotifications.value = false
})
</script>
