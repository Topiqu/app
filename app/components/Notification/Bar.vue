<template>
  <div class="fixed top-4 right-4 z-[1000]">
    <div class="relative">
      <Icon
        ref="notifButton"
        name="mdi:bell-outline"
        class="w-6 h-6 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 transition"
        @click.stop="toggleNotifications"
      />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-semibold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-white dark:ring-neutral-900 shadow-sm"
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
          class="absolute right-0 mt-3 w-[26rem] max-w-[95vw] max-h-[28rem] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl z-50 p-0 overflow-hidden flex flex-col"
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
                }"
                class="relative border-l-4 pl-3 pr-4 py-3 my-1.5 mx-2 rounded-md flex items-start gap-3 text-sm bg-white dark:bg-neutral-800 dark:text-white shadow-sm hover:shadow transition"
                :class="[
                  {
                    'border-blue-500': virtualNotifications[virtualRow.index]?.type === 'COMMENT',
                    'border-green-500': virtualNotifications[virtualRow.index]?.type === 'LIKE',
                    'border-pink-500': virtualNotifications[virtualRow.index]?.type === 'FOLLOW',
                    'border-purple-500': virtualNotifications[virtualRow.index]?.type === 'MENTION',
                    'border-yellow-500': virtualNotifications[virtualRow.index]?.type === 'ARTICLE_PUBLISHED',
                    'border-gray-500': virtualNotifications[virtualRow.index]?.type === 'SYSTEM',
                  },
                  virtualNotifications[virtualRow.index]?.isRead ? 'opacity-80' : '',
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
                  class="w-5 h-5 mt-0.5 shrink-0 text-neutral-500 dark:text-neutral-300"
                />

                <div class="w-full dark:bg-transparent">
                  <button
                    type="button"
                    class="absolute top-3 right-2 p-0 m-0 bg-transparent border-none outline-none hover:bg-transparent"
                    @click.stop="deleteNotification(virtualNotifications[virtualRow.index]!.id)"
                  >
                    <Icon
                      name="mdi:close-circle"
                      class="w-4 h-4 text-neutral-300 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                    />
                  </button>

                  <p class="text-[13px] leading-snug text-neutral-800 dark:text-neutral-200">
                    {{ virtualNotifications[virtualRow.index]!.message }}
                    <NuxtLink
                      v-if="virtualNotifications[virtualRow.index]!.link"
                      :to="virtualNotifications[virtualRow.index]!.link"
                      class="inline-block text-blue-600 dark:text-blue-400 hover:underline ml-1"
                    >
                      Zobrazit komentář
                    </NuxtLink>
                    <span
                      v-if="virtualNotifications[virtualRow.index]!.count > 1"
                      class="ml-1 text-red-500 text-[10px] font-bold"
                    >
                      ×{{ virtualNotifications[virtualRow.index]!.count }}
                    </span>
                  </p>

                  <p class="text-[11px] text-neutral-400 mt-1">
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
          <p v-else class="text-sm text-neutral-600 dark:text-neutral-300 text-center py-6">Žádné nové notifikace.</p>
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
  link?: string | null
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
    const key = [n.type, n.message, n.article?.slug ?? '', n.link ?? ''].join('|')

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
  measureElement: (el) => el?.getBoundingClientRect().height ?? 100,
  overscan: 5,
})
</script>
