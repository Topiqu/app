<template>
  <div class="fixed top-4 right-4 z-[1000]">
    <div class="relative">
      <Icon
        ref="notifButton"
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

      <Transition
        enterActiveClass="transition ease-out duration-200"
        enterFromClass="opacity-0 scale-95"
        enterToClass="opacity-100 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 scale-100"
        leaveToClass="opacity-0 scale-95"
      >
        <div
          v-if="showNotifications"
          ref="notifDropdown"
          class="absolute right-0 mt-3 w-96 max-w-[95vw] max-h-[28rem] bg-white border border-gray-200 rounded-xl shadow-xl overflow-y-auto z-50 p-4 space-y-4"
        >
          <div v-if="notifications.length" class="space-y-3">
            <div
              v-for="notification in notifications"
              :key="notification.id"
              class="relative p-3 rounded-lg shadow-sm hover:shadow transition border flex items-start gap-2"
              :class="[
                notification.isRead ? 'opacity-80' : '',
                {
                  'bg-blue-50 border-blue-200': notification.type === 'COMMENT',
                  'bg-green-50 border-green-200': notification.type === 'LIKE',
                  'bg-pink-50 border-pink-200': notification.type === 'FOLLOW',
                  'bg-purple-50 border-purple-200': notification.type === 'MENTION',
                  'bg-yellow-50 border-yellow-200': notification.type === 'ARTICLE_PUBLISHED',
                  'bg-gray-100 border-gray-300': notification.type === 'SYSTEM',
                },
              ]"
            >
              <Icon
                :name="
                  {
                    COMMENT: 'mdi:comment-outline',
                    LIKE: 'mdi:thumb-up-outline',
                    FOLLOW: 'mdi:account-plus-outline',
                    MENTION: 'mdi:at',
                    ARTICLE_PUBLISHED: 'mdi:post-outline',
                    SYSTEM: 'mdi:alert-circle-outline',
                  }[notification.type]
                "
                class="w-5 h-5 mt-0.5 shrink-0 text-gray-500"
              />

              <div class="pr-6 w-full">
                <button
                  type="button"
                  class="absolute top-2 right-2 text-red-400 hover:text-red-600 p-0.5 rounded-full transition"
                  @click.stop="deleteNotification(notification.id)"
                >
                  <Icon name="mdi:close-circle" class="w-4 h-4" />
                </button>

                <p class="text-sm">{{ notification.message }}</p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ formatDate(notification.createdAt) }}
                </p>
                <NuxtLink
                  v-if="notification.article"
                  :to="`/articles/${notification.article.slug}`"
                  class="inline-block text-xs text-blue-600 hover:underline font-medium mt-1"
                >
                  {{ notification.article.title }}
                </NuxtLink>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-600 text-center">Žádné nové notifikace.</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
const toast = useToast()
const { data: auth } = useAuth()
const showNotifications = shallowRef(false)

const { data: notificationsData, refresh } = await useFetch('/api/notifications', {
  default: () => ({ notifications: [], count: 0, unreadCount: 0 }),
  key: `notifications-${auth.value?.user.id}`,
})

const notifications = computed(() => notificationsData.value?.notifications || [])
const unreadCount = computed(() => notificationsData.value?.unreadCount || 0)

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) refresh()
}

const deleteNotification = async (id: string) => {
  try {
    await $fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    toast.error({ message: 'Chyba při mazání notifikace.' + err?.value?.message })
  }
}

const notifButton = useTemplateRef('notifButton')
const notifDropdown = useTemplateRef('notifDropdown')

onClickOutside(notifDropdown, () => (showNotifications.value = false), {
  ignore: [notifButton],
})
</script>
