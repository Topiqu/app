<template>
  <span class="relative inline-flex">
    <UPopover v-model:open="show" :content="{ align: 'end' }" @update:open="handleOpen">
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-mdi-bell-outline"
        square
        :aria-label="$t('common.actions.openNotifications')"
        :title="$t(pollActive ? 'common.notifications.pollingActive' : 'common.notifications.pollingPaused')"
      />

      <template #content>
        <div class="w-[26rem] max-w-[95vw]">
          <template v-if="auth?.user">
            <UScrollArea v-if="notifications.length" class="max-h-[30rem]">
              <div ref="scroll" class="flex flex-col gap-2 p-2">
                <UCard v-for="n in notifications" :key="n.id" variant="subtle">
                  <div class="flex min-w-0 items-start gap-3">
                    <UIcon :name="notificationIcon(n.type)" size="24" class="shrink-0" />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm text-highlighted">
                        {{ n.message }}
                        <UBadge v-if="n.count > 1" color="error" variant="soft" size="sm">×{{ n.count }}</UBadge>
                      </p>
                      <p class="mt-1 text-xs text-muted">{{ formatDate(n.createdAt) }}</p>
                      <ULink v-if="n.link" :to="n.link">{{ $t('common.actions.view') }}</ULink>
                      <ULink
                        v-if="n.article?.slug"
                        :to="localePath({ name: 'clanky-slug', params: { slug: n.article.slug } })"
                        class="block break-words"
                      >
                        {{ n.article.title }}
                      </ULink>
                    </div>
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-mdi-close-circle"
                      size="sm"
                      square
                      :aria-label="$t('common.actions.deleteNotification')"
                      :title="$t('common.actions.deleteNotification')"
                      @click.stop="del(n.id)"
                    />
                  </div>
                </UCard>
                <div ref="sentinel" class="h-px" />
                <UProgress v-if="loading" />
                <UAlert
                  v-else-if="!hasMore"
                  color="neutral"
                  variant="subtle"
                  :title="$t('common.notifications.noMore')"
                />
              </div>
            </UScrollArea>
            <UEmpty v-else icon="i-mdi-bell-off-outline" :title="$t('common.notifications.empty')" />
          </template>

          <UCard v-else variant="subtle">
            <div class="flex flex-col gap-4">
              <AppMedia
                src="/app-logo.png"
                :alt="$t('common.avatar.alt.company')"
                aspectRatio="1 / 1"
                fit="contain"
                sizes="96px"
                containerClass="mx-auto size-24 bg-transparent"
              />
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
          </UCard>
        </div>
      </template>
    </UPopover>
    <span
      v-if="unreadCount > 0"
      data-notification-count
      class="pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-error px-1 text-[11px] font-bold leading-none tabular-nums text-white ring-2 ring-default"
      aria-hidden="true"
    >
      {{ Math.min(unreadCount, 99) }}
    </span>
  </span>
</template>

<script lang="ts" setup>
import { formatDate } from '~~/shared/utils'

type Notif = {
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
type FetchResponse = { notifications: Notif[]; unreadCount: number; hasMore: boolean }

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
const url = computed(() => `/api/notifications?page=${page.value}&limit=${limit}`)
const { data: auth } = useAuth()
const localePath = useLocalePath()
const {
  data: fetchedData,
  error,
  refresh,
} = await useFetch<FetchResponse>(url, {
  immediate: !!auth.value?.user,
})

const POLL_INTERVAL_MS = 10_000
const pollEnabled = computed(() => !!auth?.value?.user)
const visibility = useDocumentVisibility()
const pollActive = computed(() => pollEnabled.value && visibility.value === 'visible')

const poll = async () => {
  if (!pollEnabled.value) return
  try {
    const res = await $fetch<{ notifications: Notif[]; unreadCount: number }>('/api/notifications/poll', {
      query: { since: data.value[0]?.createdAt ?? undefined },
    })
    const known = new Set(data.value.map((n) => n.id))
    const fresh = res.notifications.filter((n) => n?.id && !known.has(n.id))
    if (fresh.length) {
      data.value = [...fresh, ...data.value]
      for (const n of fresh) useAppToast().add({ color: 'success', title: `Nová notifikace: ${n.message}` })
    }
    unreadCount.value = res.unreadCount
  } catch {
    // next tick retries
  }
}

const { pause, resume } = useIntervalFn(poll, POLL_INTERVAL_MS, { immediate: false })

watch(
  pollActive,
  (active) => {
    if (active) resume()
    else pause()
  },
  { immediate: true },
)

watch(
  fetchedData,
  async (v) => {
    if (!v) return
    data.value = page.value === 1 ? v.notifications : [...data.value, ...v.notifications]
    unreadCount.value = v.unreadCount || 0
    hasMore.value = v.hasMore && data.value.length < max
    if (data.value.length >= max) hasMore.value = false
    if (scroll.value && v.notifications.length) await nextTick()
  },
  { immediate: true },
)

watch(error, (e) => {
  if (e) useAppToast().add({ color: 'error', title: `Chyba při načítání: ${e.message || 'Neznámá chyba'}` })
})

const notifications = computed(() => {
  const map = new Map<string, Notif>()
  for (const n of data.value) {
    const key = [n.type, n.message, n.article?.slug ?? '', n.link ?? ''].join('|')
    if (map.has(key)) {
      const ex = map.get(key)!
      ex.count++
      if (new Date(n.createdAt) > new Date(ex.createdAt))
        Object.assign(ex, { createdAt: n.createdAt, id: n.id, isRead: n.isRead })
    } else map.set(key, { ...n, count: 1 })
  }
  return [...map.values()]
})

const handleOpen = (open: boolean) => {
  if (open && auth?.value?.user) {
    page.value = 1
    refresh()
  }
}

const notificationIcon = (type: string) =>
  ({
    COMMENT: 'i-mdi-comment-outline',
    LIKE: 'i-mdi-thumb-up-outline',
    FOLLOW: 'i-mdi-account-plus-outline',
    MENTION: 'i-mdi-at',
    ARTICLE_PUBLISHED: 'i-mdi-post-outline',
    SYSTEM: 'i-mdi-alert-circle-outline',
  })[type] || 'i-mdi-bell-outline'

const del = async (id: string) => {
  try {
    const target = data.value.find((n) => n.id === id)
    if (!target) return
    const key = [target.type, target.message, target.article?.slug ?? '', target.link ?? ''].join('|')
    const toDelete = data.value.filter((n) => {
      const nKey = [n.type, n.message, n.article?.slug ?? '', n.link ?? ''].join('|')
      return nKey === key
    })
    await Promise.all(toDelete.map((n) => $fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })))
    data.value = data.value.filter((n) => {
      const nKey = [n.type, n.message, n.article?.slug ?? '', n.link ?? ''].join('|')
      return nKey !== key
    })
    unreadCount.value = data.value.filter((n) => !n.isRead).length
  } catch (e: any) {
    useAppToast().add({ color: 'error', title: `Chyba při mazání: ${e.data?.message || 'Neznámá chyba'}` })
  }
}

watch(
  () => auth?.value?.user,
  async (u) => {
    if (u && import.meta.client) {
      page.value = 1
      await refresh()
    } else {
      data.value = []
      unreadCount.value = 0
    }
  },
  { immediate: true },
)

watch(
  () => [show.value, sentinel.value] as const,
  async ([s, sent], _previous, onCleanup) => {
    if (s && sent && scroll.value && auth?.value?.user) {
      const o = new IntersectionObserver(
        async (e) => {
          if (e[0]?.isIntersecting && !loading.value && hasMore.value) {
            loading.value = true
            page.value++
            await refresh()
            await nextTick()
            loading.value = false
          }
        },
        { root: scroll.value, threshold: 0.01 },
      )
      o.observe(sent)
      onCleanup(() => o.disconnect())
    }
  },
)
</script>
