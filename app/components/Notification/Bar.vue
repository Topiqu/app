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
        enterActivClass="transition ease-out duration-200"
        enterFromClass="opacity-0 scale-95"
        enterToClass="opacity-100 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 scale-100"
        leaveToClass="opacity-0 scale-95"
      >
        <div
          v-if="showNotifications"
          ref="notifDropdown"
          class="absolute right-0 mt-3 w-96 max-w-[95vw] max-h-[28rem] bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-0 overflow-hidden flex flex-col"
        >
          <div
            v-if="virtualNotifications.length"
            ref="scrollParent"
            class="relative overflow-y-auto flex-1"
            :style="{ height: '28rem' }"
          >
            <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
              <div
                v-for="virtualRow in virtualizer.getVirtualItems()"
                :key="String(virtualRow.key)"
                :style="{
                  position: 'absolute',
                  top: `${virtualRow.start}px`,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                }"
                class="rounded-lg shadow-sm hover:shadow transition border mx-3 my-1.5 px-3 py-2.5 flex items-start gap-2 text-sm break-words whitespace-normal"
                :class="[
                  {
                    'bg-blue-50 border-blue-200': virtualNotifications[virtualRow.index]?.type === 'COMMENT',
                    'bg-green-50 border-green-200': virtualNotifications[virtualRow.index]?.type === 'LIKE',
                    'bg-pink-50 border-pink-200': virtualNotifications[virtualRow.index]?.type === 'FOLLOW',
                    'bg-purple-50 border-purple-200': virtualNotifications[virtualRow.index]?.type === 'MENTION',
                    'bg-yellow-50 border-yellow-200':
                      virtualNotifications[virtualRow.index]?.type === 'ARTICLE_PUBLISHED',
                    'bg-gray-100 border-gray-300': virtualNotifications[virtualRow.index]?.type === 'SYSTEM',
                  },
                  virtualNotifications[virtualRow.index]?.isRead ? 'opacity-80' : 'ring-1 ring-inset ring-blue-200',
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
                    }[virtualNotifications[virtualRow.index]!.type]
                  "
                  class="w-5 h-5 mt-0.5 shrink-0 text-gray-500"
                />

                <div class="w-full relative">
                  <button
                    type="button"
                    class="absolute top-4 right-1 text-gray-300 hover:text-red-500 p-0.5 rounded-full transition"
                    @click.stop="deleteNotification(virtualNotifications[virtualRow.index]!.id)"
                  >
                    <Icon name="mdi:close-circle" class="w-4 h-4" />
                  </button>

                  <p class="text-xs text-gray-800 leading-snug">
                    {{ virtualNotifications[virtualRow.index]!.message }}
                    <span
                      v-if="virtualNotifications[virtualRow.index]!.count > 1"
                      class="ml-1 text-red-500 text-[10px] font-bold"
                    >
                      ×{{ virtualNotifications[virtualRow.index]!.count }}
                    </span>
                  </p>

                  <p class="text-[11px] text-gray-400 mt-1">
                    {{ formatDate(virtualNotifications[virtualRow.index]!.createdAt) }}
                  </p>

                  <NuxtLink
                    v-if="virtualNotifications[virtualRow.index]?.article"
                    :to="`/articles/${virtualNotifications[virtualRow.index]!.article?.slug}`"
                    class="inline-block text-xs text-blue-600 hover:underline font-medium mt-1"
                  >
                    {{ virtualNotifications[virtualRow.index]!.article?.title }}
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-gray-600 text-center py-6">Žádné nové notifikace.</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useVirtualizer } from '@tanstack/vue-virtual'

type Notification = {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
  articleId: string | null
  article?: { slug: string; title: string } | null
  count: number
}

const toast = useToast()
const { data: auth } = useAuth()
const showNotifications = shallowRef(false)

const { data: notificationsData, refresh } = await useFetch('/api/notifications', {
  default: () => ({ notifications: [], count: 0, unreadCount: 0 }),
  key: `notifications-${auth.value?.user.id}`,
})

const notifications = computed(() => notificationsData.value?.notifications || [])
const unreadCount = computed(() => notificationsData.value?.unreadCount || 0)

const dedupNotifications = computed(() => {
  const map = new Map<string, Notification>()

  for (const n of notifications.value) {
    const key = [n.type, n.message, n.article?.slug ?? ''].join('|')

    if (map.has(key)) {
      const existing = map.get(key)!
      existing.count++
      if (new Date(n.createdAt) > new Date(existing.createdAt)) {
        existing.createdAt = n.createdAt
        existing.id = n.id
        existing.isRead = n.isRead
      }
    } else {
      map.set(key, { ...n, count: 1 })
    }
  }

  return Array.from(map.values())
})

const virtualNotifications = dedupNotifications

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) refresh()
}

const deleteNotification = async (id: string) => {
  try {
    await $fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    toast.error({ message: `Chyba při mazání notifikace: ${err?.value?.message || 'Neznámá chyba'}` })
  }
}

const notifButton = useTemplateRef('notifButton')
const notifDropdown = useTemplateRef('notifDropdown')
const scrollParent = ref<Element>()

onClickOutside(notifDropdown, () => (showNotifications.value = false), {
  ignore: [notifButton],
})

const virtualizer = useVirtualizer({
  count: virtualNotifications.value.length,
  getScrollElement: () => scrollParent.value,
  estimateSize: () => 100,
  overscan: 5,
})
</script>
