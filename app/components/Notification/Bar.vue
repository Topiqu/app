<template>
  <div class="relative">
    <div v-if="auth?.user">
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 shadow-sm hover:shadow-md"
        @click.stop="toggle"
      >
        <Icon
          ref="btn"
          name="mdi:bell-outline"
          class="w-6 h-6 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
        />
      </button>
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-semibold rounded-full h-4 w-4 flex items-center justify-center ring-1 ring-white dark:ring-neutral-900"
      >
        {{ unreadCount }}
      </span>
      <span
        class="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-white dark:ring-neutral-900"
        :class="sseDot.color"
        :title="`Notifikace: ${sseDot.label}${sseRetries > 0 ? ` (pokus #${sseRetries})` : ''}`"
        :aria-label="`Realtime status: ${sseDot.label}`"
      />
      <Transition
        enterActiveClass="transition ease-out duration-200"
        enterFromClass="opacity-0 scale-95"
        enterToClass="opacity-100 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 scale-100"
        leaveToClass="opacity-0 scale-95"
      >
        <div
          v-if="show"
          ref="dropdown"
          class="absolute right-0 mt-3 w-[26rem] max-w-[95vw] max-h-[30rem] bg-white dark:bg-neutral-900 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
        >
          <div v-if="notifications.length" ref="scroll" class="relative overflow-y-auto flex-1 min-h-[100px]">
            <div
              v-for="n in notifications"
              :key="n.id"
              class="relative border-l-4 pl-3 pr-4 py-3 my-1.5 mx-2 rounded-md flex items-start gap-3 text-sm bg-white dark:bg-neutral-800 dark:text-white shadow-sm hover:shadow transition"
              :class="[
                {
                  'border-blue-500': n.type === 'COMMENT',
                  'border-green-500': n.type === 'LIKE',
                  'border-pink-500': n.type === 'FOLLOW',
                  'border-purple-500': n.type === 'MENTION',
                  'border-yellow-500': n.type === 'ARTICLE_PUBLISHED',
                  'border-gray-500': n.type === 'SYSTEM',
                },
                n.isRead ? 'opacity-80' : '',
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
                  }[n.type]!
                "
                class="w-6 h-6 mt-0.5 shrink-0 text-neutral-500 dark:text-neutral-300"
              />
              <div class="w-full">
                <button
                  type="button"
                  class="absolute top-3 right-2 p-0 bg-transparent border-none outline-none"
                  @click.stop="del(n.id)"
                >
                  <Icon
                    name="mdi:close-circle"
                    class="w-6 h-6 text-neutral-300 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                  />
                </button>
                <p class="text-[13px] leading-snug text-neutral-800 dark:text-neutral-200">
                  {{ n.message }}
                  <NuxtLink
                    v-if="n.link"
                    :to="n.link"
                    class="inline-block text-blue-600 dark:text-blue-400 hover:underline ml-1"
                  >
                    Zobrazit
                  </NuxtLink>
                  <span v-if="n.count > 1" class="ml-1 text-red-500 text-[10px] font-bold">×{{ n.count }}</span>
                </p>
                <p class="text-[11px] text-neutral-400 mt-1">{{ formatDate(n.createdAt) }}</p>
                <NuxtLink
                  v-if="n.article"
                  :to="`/clanky/${n.article.slug}`"
                  class="inline-block text-xs text-blue-600 hover:underline font-medium mt-1"
                >
                  {{ n.article.title }}
                </NuxtLink>
              </div>
            </div>
            <div ref="sentinel" class="h-1"></div>
            <div v-if="loading" class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm">
              Načítání...
            </div>
            <div
              v-if="!hasMore && notifications.length"
              class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm"
            >
              Žádné další notifikace
            </div>
          </div>
          <p v-else class="text-sm text-neutral-600 dark:text-neutral-300 text-center py-6">Žádné nové notifikace.</p>
        </div>
      </Transition>
    </div>
    <div v-else>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 shadow-sm hover:shadow-md"
        @click.stop="toggle"
      >
        <Icon
          ref="btn"
          name="mdi:bell-outline"
          class="w-6 h-6 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
        />
      </button>
      <Transition
        enterActiveClass="transition ease-out duration-200"
        enterFromClass="opacity-0 scale-95"
        enterToClass="opacity-100 scale-100"
        leaveActiveClass="transition ease-in duration-150"
        leaveFromClass="opacity-100 scale-100"
        leaveToClass="opacity-0 scale-95"
      >
        <div
          v-if="show"
          ref="dropdown"
          class="absolute right-0 mt-3 w-[26rem] max-w-[95vw] bg-white dark:bg-neutral-900 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col p-4 sm:p-5"
        >
          <NuxtImg
            src="/app-logo.png"
            alt="Logo firmy"
            class="w-24 h-24 mx-auto object-contain"
            width="96"
            height="96"
          />
          <div class="flex flex-col gap-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-300 text-center">
              Přihlaste se a sledujte novinky a aktivity na platformě.
            </p>
            <div class="flex flex-col gap-2">
              <NuxtLink
                to="/autorizace"
                class="block w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center transition"
              >
                Přihlásit se
              </NuxtLink>
              <NuxtLink
                to="/autorizace?mode=register"
                class="block w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-center text-sm font-semibold transition"
              >
                Registrovat
              </NuxtLink>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
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
const btn = useTemplateRef('btn')
const dropdown = useTemplateRef('dropdown')
const scroll = useTemplateRef('scroll')
const sentinel = useTemplateRef('sentinel')
const url = computed(() => `/api/notifications?page=${page.value}&limit=${limit}`)
const { data: auth } = useAuth()
const { data: fetchedData, error, refresh } = await useFetch<FetchResponse>(url)

const sseUrl = computed(() => (auth?.value?.user ? '/api/notifications/sse' : undefined))

const { status: sseStatus, isStale: sseStale, reconnectAttempts: sseRetries } = useRealtime(sseUrl, {
  enabled: () => !!auth?.value?.user,
  handlers: {
    'notification.created': (n: Notif) => {
      if (!n?.id || !['COMMENT', 'LIKE', 'FOLLOW', 'MENTION', 'ARTICLE_PUBLISHED', 'SYSTEM'].includes(n.type)) return
      data.value = [n, ...data.value]
      unreadCount.value = data.value.filter((x) => !x.isRead).length
      useToast().success({ message: `Nová notifikace: ${n.message}` })
    },
  },
  debug: import.meta.dev,
})

const sseDot = computed(() => {
  if (sseStale.value) return { color: 'bg-amber-500', label: 'stale' }
  if (sseStatus.value === 'OPEN') return { color: 'bg-green-500', label: 'live' }
  if (sseStatus.value === 'CONNECTING') return { color: 'bg-yellow-500 animate-pulse', label: 'connecting' }
  return { color: 'bg-red-500', label: 'offline' }
})

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
  if (e) useToast().error({ message: `Chyba při načítání: ${e.message || 'Neznámá chyba'}` })
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

const toggle = () => {
  show.value = !show.value
  if (show.value && auth?.value?.user) {
    page.value = 1
    refresh()
  }
}

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
    useToast().error({ message: `Chyba při mazání: ${e.data?.message || 'Neznámá chyba'}` })
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
  [show, sentinel],
  async ([s, sent]) => {
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
      return () => o.disconnect()
    }
  },
  { immediate: true },
)

onClickOutside(dropdown, () => (show.value = false), { ignore: [btn] })
</script>
