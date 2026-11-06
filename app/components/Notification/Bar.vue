<template>
  <span class="relative inline-flex">
    <UPopover
      v-model:open="show"
      :content="{ align: 'end' }"
      :ui="{ content: 'overflow-hidden rounded-(--topiqu-surface-radius) p-0' }"
      @update:open="handleOpen"
    >
      <UButton
        ref="notificationTrigger"
        color="neutral"
        variant="ghost"
        icon="mdi:bell-outline"
        square
        :aria-label="triggerLabel"
        :title="pollProblem ? $t(pollProblem) : triggerLabel"
      />

      <template #content>
        <div class="w-[26rem] max-w-[95vw]">
          <template v-if="auth?.user">
            <div class="flex items-center justify-between gap-2 border-b border-default bg-default py-1.5 pl-4 pr-2">
              <h2 class="text-sm font-semibold text-highlighted">{{ $t('common.notifications.title') }}</h2>
              <UButton
                :to="localePath({ name: 'uzivatel', query: { tab: 'notifications' } })"
                color="neutral"
                variant="ghost"
                icon="mdi:cog-outline"
                size="sm"
                square
                :aria-label="$t('common.notifications.settings')"
                :title="$t('common.notifications.settings')"
                @click="show = false"
              />
            </div>
            <UAlert
              v-if="pollProblem"
              color="warning"
              variant="soft"
              icon="mdi:bell-alert-outline"
              :title="$t(pollProblem)"
              class="m-3"
            >
              <template #actions>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :label="$t('common.messages.retry')"
                  @click="retryPolling"
                />
              </template>
            </UAlert>
            <UScrollArea v-if="notifications.length" class="max-h-[30rem]">
              <div ref="scroll" class="bg-default">
                <div v-for="group in groups" :key="group.key">
                  <h3 class="sticky top-0 z-20 bg-default px-4 pb-1 pt-3 text-xs font-semibold text-muted">
                    {{ group.label }}
                  </h3>
                  <ul class="divide-y divide-default">
                    <li
                      v-for="n in group.items"
                      :key="n.id"
                      :data-notification-id="n.id"
                      class="group relative grid grid-cols-[0.5rem_2.5rem_minmax(0,1fr)_auto] items-start gap-x-2.5 py-3 pl-2 pr-2 transition-colors"
                      :class="[n.isNew && 'bg-primary/5', n.to && 'hover:bg-elevated/60']"
                    >
                      <span class="mt-4 size-2 rounded-full" :class="n.isNew && 'bg-primary'">
                        <span v-if="n.isNew" class="sr-only">{{ $t('common.notifications.unread') }}</span>
                      </span>
                      <AppMedia
                        v-if="n.article?.imageUrl"
                        :src="n.article.imageUrl"
                        alt=""
                        aspectRatio="1 / 1"
                        sizes="40px"
                        containerClass="size-10 rounded-[var(--ui-radius)]"
                      />
                      <span v-else class="grid size-10 place-items-center rounded-[var(--ui-radius)] bg-elevated">
                        <UIcon :name="notificationIcon(n.type)" size="20" class="text-muted" />
                      </span>
                      <div class="min-w-0 text-sm leading-5">
                        <!-- The stretched ::after makes the whole row one link without nesting the delete button in it. -->
                        <ULink
                          v-if="n.to"
                          raw
                          :to="n.to"
                          class="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
                          @click="show = false"
                        >
                          <span class="block whitespace-pre-line break-words font-medium text-highlighted">{{
                            n.message
                          }}</span>
                          <span v-if="n.article" class="line-clamp-1 break-words text-muted">{{
                            n.article.title
                          }}</span>
                        </ULink>
                        <p v-else class="whitespace-pre-line break-words font-medium text-highlighted">
                          {{ n.message }}
                        </p>
                        <p class="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <AppTime :datetime="n.createdAt" :preset="group.key === today ? 'relative' : 'time'" />
                          <UBadge v-if="n.count > 1" color="neutral" variant="soft" size="sm">×{{ n.count }}</UBadge>
                        </p>
                      </div>
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="mdi:close"
                        size="xs"
                        square
                        class="relative z-10 justify-center pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 pointer-coarse:size-11"
                        :aria-label="$t('common.actions.deleteNotification')"
                        :title="$t('common.actions.deleteNotification')"
                        :loading="deletingKeys.has(notificationKey(n))"
                        :disabled="deletingKeys.has(notificationKey(n))"
                        @click.stop="del(n.id)"
                      />
                    </li>
                  </ul>
                </div>
                <div ref="sentinel" class="h-px" />
                <UProgress v-if="loading" />
              </div>
            </UScrollArea>
            <UEmpty v-else variant="naked" icon="mdi:bell-off-outline" :title="$t('common.notifications.empty')" />
          </template>

          <div v-else class="bg-default p-4">
            <div class="flex flex-col gap-2">
              <AppLogo :alt="$t('common.avatar.alt.company')" class="mx-auto size-24" />
              <p class="text-center text-sm text-muted">{{ $t('common.notifications.loginPrompt') }}</p>
              <UButton :to="localePath({ name: 'autorizace' })" block>{{ $t('common.auth.login') }}</UButton>
              <UButton
                :to="localePath({ name: 'autorizace', query: { mode: 'register' } })"
                color="neutral"
                variant="soft"
                block
              >
                {{ $t('common.auth.register') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UPopover>
    <span
      v-if="badgeCount > 0"
      data-notification-count
      class="pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-error px-1 text-[11px] font-bold leading-none tabular-nums text-white ring-2 ring-default"
      aria-hidden="true"
    >
      {{ badgeCount > 99 ? '99+' : badgeCount }}
    </span>
  </span>
</template>

<script lang="ts" setup>
import type { InternalApi } from 'nitropack'
import type { NotificationCursor } from '~~/shared/types/notification'

type Notif = {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
  articleId: string | null
  article?: { slug: string; language: Language; title: string; imageUrl: string | null } | null
  link?: string | null
}
type FetchResponse = {
  notifications: Notif[]
  unreadCount: number
  hasMore: boolean
  cursor?: NotificationCursor
}
const notificationKey = (n: Notif) => [n.type, n.message, n.article?.slug ?? '', n.link ?? ''].join('|')

const show = shallowRef(false)
const page = shallowRef(1)
const limit = 25
const max = 75
const loading = shallowRef(false)
const hasMore = shallowRef(true)
const data = ref<Notif[]>([])
const unreadCount = shallowRef(0)
const scroll = useTemplateRef('scroll')
const sentinel = useTemplateRef('sentinel')
const notificationTrigger = useTemplateRef<any>('notificationTrigger')
const deletingKeys = ref(new Set<string>())
// Stays lit until the panel closes, although the rows are already read on the server.
const highlighted = shallowRef(new Set<string>())
const pendingDeletes = ref(new Map<string, Notif[]>())
const optimisticStatus = useOptimisticStatus()
const url = computed(() => `/api/notifications?page=${page.value}&limit=${limit}`)
const { data: auth } = useAuth()
const localePath = useLocalePath()
const { locale } = useI18n()
const toast = useToast()
const {
  data: fetchedData,
  error,
  refresh,
} = await useFetch<FetchResponse>(url, {
  key: computed(() => `notifications:${auth.value?.user?.id ?? 'guest'}`),
  immediate: !!auth.value?.user,
})

const { status: pollStatus, retry: retryPolling } = useNotificationPolling<Notif>({
  initialCursor: () => fetchedData.value?.cursor,
  reset: () => {
    data.value = []
    unreadCount.value = 0
    deletingKeys.value = new Set()
    pendingDeletes.value = new Map()
    highlighted.value = new Set()
  },
  receive: (res) => {
    const known = new Set(data.value.map((n) => n.id))
    const fresh = res.notifications.filter(
      (n) => n?.id && !known.has(n.id) && !deletingKeys.value.has(notificationKey(n)),
    )
    if (fresh.length) {
      data.value = [...fresh, ...data.value]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, max)
      if (!show.value) announce(fresh)
    }
    const hiddenUnread = [...pendingDeletes.value.values()].flat().filter((n) => !n.isRead).length
    unreadCount.value = Math.max(0, res.unreadCount - hiddenUnread)
    if (show.value) void markRead()
  },
})
const pollProblem = computed(() =>
  pollStatus.value === 'retrying'
    ? 'common.notifications.pollingRetrying'
    : pollStatus.value === 'forbidden'
      ? 'common.notifications.pollingUnavailable'
      : pollStatus.value === 'unauthorized'
        ? 'common.notifications.pollingSignIn'
        : null,
)
const badgeCount = computed(() => (show.value ? 0 : unreadCount.value))
const triggerLabel = computed(() =>
  badgeCount.value > 0
    ? $t('common.notifications.openWithUnread', { count: badgeCount.value })
    : $t('common.actions.openNotifications'),
)

const toastId = 'notifications-new'
let announced = 0
// Draining a backlog arrives in batches, so one toast keeps a running total instead of stacking.
const announce = (fresh: Notif[]) => {
  if (!toast.toasts.value.some((item) => item.id === toastId)) announced = 0
  announced += fresh.length
  toast.add({
    id: toastId,
    color: 'neutral',
    icon: 'mdi:bell-outline',
    title:
      announced === 1
        ? $t('common.notifications.newNotification', { message: fresh[0]!.message })
        : $t('common.notifications.newNotifications', { count: announced }),
  })
}

const markRead = async () => {
  const before = data.value[0]?.createdAt
  if (!before || !unreadCount.value) return
  const userId = auth.value?.user?.id
  highlighted.value = new Set([...highlighted.value, ...data.value.filter((n) => !n.isRead).map((n) => n.id)])
  data.value = data.value.map((n) => (n.isRead ? n : { ...n, isRead: true }))
  try {
    const res = await $fetch<{ unreadCount: number }, '/api/notifications/read'>('/api/notifications/read', {
      method: 'POST',
      body: { before },
    })
    if (auth.value?.user?.id === userId) unreadCount.value = res.unreadCount
  } catch {
    // Nothing is lost: the badge keeps its count and the next opening retries.
  }
}

watch(
  fetchedData,
  async (v) => {
    if (!v) return
    const visible = v.notifications.filter((n) => !deletingKeys.value.has(notificationKey(n)))
    data.value =
      page.value === 1
        ? visible
        : [...new Map([...data.value, ...visible].map((n) => [n.id, n])).values()].slice(0, max)
    const hiddenUnread = [...pendingDeletes.value.values()].flat().filter((n) => !n.isRead).length
    unreadCount.value = Math.max(0, (v.unreadCount || 0) - hiddenUnread)
    hasMore.value = v.hasMore && data.value.length < max
    if (data.value.length >= max) hasMore.value = false
    if (scroll.value && v.notifications.length) await nextTick()
  },
  { immediate: true },
)

watch(error, (e) => {
  if (e && auth.value?.user && ![401, 403].includes(e.statusCode ?? 0))
    useToast().add({
      color: 'error',
      title: $t('common.notifications.loadFailed', { message: e.message || $t('common.error') }),
    })
})

const rowTarget = (n: Notif) =>
  n.link ||
  (n.article?.slug
    ? localePath({ name: 'clanky-slug', params: { slug: n.article.slug } }, n.article.language)
    : undefined)

const notifications = computed(() => {
  const map = new Map<string, Notif & { count: number; isNew: boolean; to?: string }>()
  for (const n of data.value) {
    const key = notificationKey(n)
    const ex = map.get(key)
    const isNew = highlighted.value.has(n.id)
    if (ex) {
      ex.count++
      ex.isNew ||= isNew
      if (new Date(n.createdAt) > new Date(ex.createdAt))
        Object.assign(ex, {
          createdAt: n.createdAt,
          id: n.id,
          isRead: n.isRead,
        })
    } else map.set(key, { ...n, count: 1, isNew, to: rowTarget(n) })
  }
  return [...map.values()]
})
const groups = computed(() =>
  groupByDay(notifications.value, { locale: locale.value, timeZone: TOPIQU_TIME_ZONE, relativeTo: new Date() }),
)
const today = computed(() => dayKey(new Date(), TOPIQU_TIME_ZONE))

const handleOpen = async (open: boolean) => {
  if (!open) {
    highlighted.value = new Set()
    return
  }
  if (!auth?.value?.user || pollStatus.value === 'forbidden' || pollStatus.value === 'unauthorized') return
  loading.value = true
  page.value = 1
  await refresh()
  await nextTick()
  loading.value = false
  if (show.value) await markRead()
}

const notificationIcon = (type: string) =>
  ({
    COMMENT: 'mdi:comment-outline',
    LIKE: 'mdi:thumb-up-outline',
    FOLLOW: 'mdi:account-plus-outline',
    MENTION: 'mdi:at',
    ARTICLE_PUBLISHED: 'mdi:post-outline',
    SYSTEM: 'mdi:alert-circle-outline',
  })[type] || 'mdi:bell-outline'

const focusAfterRemoval = async (id?: string) => {
  await nextTick()
  const target = id
    ? scroll.value?.querySelector<HTMLElement>(
        `[data-notification-id="${id}"] button, [data-notification-id="${id}"] a`,
      )
    : null
  target?.focus()
  if (!target) (notificationTrigger.value?.$el as HTMLElement | undefined)?.focus?.()
}

const del = async (id: string) => {
  const userId = auth.value?.user?.id
  const rendered = notifications.value
  const renderedIndex = rendered.findIndex((n) => n.id === id)
  const focusId = rendered[renderedIndex + 1]?.id ?? rendered[renderedIndex - 1]?.id
  const target = data.value.find((n) => n.id === id)
  if (!target) return
  const key = notificationKey(target)
  if (deletingKeys.value.has(key)) return
  const toDelete = data.value.filter((n) => notificationKey(n) === key)
  const removedUnread = toDelete.filter((n) => !n.isRead).length

  deletingKeys.value = new Set([...deletingKeys.value, key])
  pendingDeletes.value = new Map(pendingDeletes.value).set(key, toDelete)
  data.value = data.value.filter((n) => notificationKey(n) !== key)
  unreadCount.value = Math.max(0, unreadCount.value - removedUnread)
  optimisticStatus.saving()
  void focusAfterRemoval(focusId)

  try {
    await Promise.all(
      toDelete.map((n) =>
        $fetch<InternalApi['/api/notifications/:id']['delete'], '/api/notifications/:id'>(
          `/api/notifications/${n.id}` as '/api/notifications/:id',
          { method: 'DELETE' },
        ),
      ),
    )
    if (auth.value?.user?.id === userId) optimisticStatus.saved()
  } catch (e: any) {
    if (auth.value?.user?.id !== userId) return
    const known = new Set(data.value.map((n) => n.id))
    data.value = [...data.value, ...toDelete.filter((n) => !known.has(n.id))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    unreadCount.value += removedUnread
    optimisticStatus.reverted()
    useToast().add({
      color: 'error',
      title: $t('common.notifications.deleteFailed', {
        message: fetchErrorMessage(e, $t('common.error')),
      }),
    })
  } finally {
    if (auth.value?.user?.id === userId) {
      const nextDeleting = new Set(deletingKeys.value)
      nextDeleting.delete(key)
      deletingKeys.value = nextDeleting
      const nextDeletes = new Map(pendingDeletes.value)
      nextDeletes.delete(key)
      pendingDeletes.value = nextDeletes
    }
  }
}

watch(
  () => auth?.value?.user?.id,
  async (u) => {
    if (u && import.meta.client) {
      page.value = 1
      await refresh()
    } else {
      data.value = []
      unreadCount.value = 0
    }
  },
)

const loadMore = async () => {
  loading.value = true
  page.value++
  await refresh()
  await nextTick()
  if (error.value) page.value--
  loading.value = false
}
// With no explicit root the observer still clips to the scroll area. An open error stops a retry loop.
const sentinelVisible = useElementVisibility(sentinel)
watch([sentinelVisible, loading], ([visible, busy]) => {
  if (visible && !busy && show.value && hasMore.value && !error.value && auth.value?.user) void loadMore()
})
</script>
