<template>
  <ClientOnly>
    <Teleport to="body">
      <button
        v-if="!visible"
        type="button"
        class="fixed bottom-4 left-4 z-devtools grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-md transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        aria-label="Open DevConsole"
        @click="visible = true"
      >
        <Icon name="i-lucide:terminal" class="h-4 w-4" />
      </button>

      <section
        v-else
        ref="panel"
        :style="style"
        class="fixed z-devtools w-60 select-none overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        :class="{ 'transition-[left,top] duration-300 ease-out': !isDragging }"
      >
        <header
          ref="handle"
          class="flex cursor-grab items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 active:cursor-grabbing dark:border-gray-800"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <Icon name="i-lucide:grip-vertical" class="-ml-1 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-600" />
            <template v-if="collapsed">
              <span class="flex min-w-0 items-center gap-1.5 text-[10px] font-medium">
                <Icon
                  :name="activeView.icon"
                  class="h-3 w-3 shrink-0"
                  :class="view === 'auto' ? 'text-gray-400 dark:text-gray-500' : 'text-amber-500'"
                />
                <span class="truncate text-gray-700 dark:text-gray-200">{{ clientSite?.name || 'landing' }}</span>
                <template v-if="clientSite">
                  <span class="text-gray-300 dark:text-gray-700">·</span>
                  <span class="shrink-0 font-mono uppercase text-sky-600 dark:text-sky-400">{{ clientSite.plan }}</span>
                </template>
                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dbDot" title="db" />
                <span
                  v-if="meta?.dirty"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  title="uncommitted changes"
                />
              </span>
            </template>
            <template v-else>
              <Icon name="i-lucide:terminal" class="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
              <span class="text-xs font-semibold text-gray-900 dark:text-gray-100">DevConsole</span>
            </template>
          </span>
          <span class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              :class="headerBtn"
              :aria-label="collapsed ? 'Expand' : 'Collapse'"
              @click="collapsed = !collapsed"
            >
              <Icon name="i-lucide:chevron-down" class="h-4 w-4 transition-transform" :class="collapsed ? '' : 'rotate-180'" />
            </button>
            <button type="button" :class="headerBtn" aria-label="Hide DevConsole" @click="visible = false">
              <Icon name="i-lucide:x" class="h-4 w-4" />
            </button>
          </span>
        </header>

        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out"
          :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
        >
          <div class="overflow-hidden">
            <div class="space-y-3 px-3 py-3">
              <section class="space-y-1.5">
                <p :class="labelCls">Render view</p>
                <div class="grid grid-cols-3" :class="segGroup">
                  <button
                    v-for="v in views"
                    :key="v.id"
                    type="button"
                    class="flex items-center justify-center gap-1 rounded-md border-0 px-2 py-1 text-[11px] capitalize transition-colors"
                    :class="seg(view === v.id)"
                    @click="view = v.id"
                  >
                    <Icon :name="v.icon" class="h-3 w-3 shrink-0" />
                    {{ v.id }}
                  </button>
                </div>
                <p
                  v-if="view !== 'auto'"
                  class="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <Icon name="i-lucide:triangle-alert" class="h-3 w-3 shrink-0" />
                  forcing <b class="font-semibold">{{ view }}</b> — overrides resolver
                </p>
              </section>

              <section v-if="clientSite" class="space-y-1.5 border-t border-gray-200 pt-3 dark:border-gray-800">
                <p :class="labelCls">Plan</p>
                <div class="grid grid-cols-2" :class="segGroup">
                  <button
                    v-for="p in plans"
                    :key="p"
                    type="button"
                    :disabled="busy"
                    class="rounded-md border-0 px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    :class="seg(clientSite.plan === p)"
                    @click="switchPlan(p)"
                  >
                    {{ p }}
                  </button>
                </div>
              </section>

              <section class="space-y-1.5 border-t border-gray-200 pt-3 dark:border-gray-800">
                <p :class="labelCls">Impersonate</p>
                <div class="grid grid-cols-3" :class="segGroup">
                  <button
                    v-for="u in seedUsers"
                    :key="u.email"
                    type="button"
                    :disabled="busy"
                    class="flex items-center justify-center gap-1 rounded-md border-0 px-2 py-1 text-[11px] capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    :class="seg(currentUser === u.email)"
                    @click="impersonate(u.email)"
                  >
                    <Icon :name="u.icon" class="h-3 w-3 shrink-0" />
                    {{ u.label }}
                  </button>
                </div>
                <p class="flex items-center gap-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
                  <Icon
                    :name="isGuest ? 'i-lucide:user-x' : 'i-lucide:user-check'"
                    class="h-3 w-3 shrink-0"
                    :class="isGuest ? '' : 'text-emerald-500'"
                  />
                  <span class="truncate font-mono text-gray-700 dark:text-gray-200">{{ currentUser }}</span>
                </p>
              </section>

              <section class="space-y-1.5 border-t border-gray-200 pt-3 dark:border-gray-800">
                <p :class="labelCls">Locale</p>
                <LangSwitcher v-model:language="language" class="w-full" />
              </section>

              <dl class="space-y-1.5 border-t border-gray-200 pt-3 text-[11px] dark:border-gray-800">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">branch</dt>
                  <dd class="truncate text-right font-mono text-gray-700 dark:text-gray-200">
                    {{ meta?.branch || '—' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">commit</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <span
                      v-if="meta?.dirty"
                      class="rounded bg-amber-100 px-1 text-[9px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      title="uncommitted changes"
                    >
                      dirty
                    </span>
                    <a
                      v-if="commitUrl"
                      :href="commitUrl"
                      target="_blank"
                      rel="noopener"
                      class="font-mono text-gray-700 underline-offset-2 hover:underline dark:text-gray-200"
                      title="Open commit on remote"
                    >
                      {{ meta?.hash }}
                    </a>
                    <span v-else class="font-mono text-gray-700 dark:text-gray-200">{{ meta?.hash || '—' }}</span>
                    <button
                      type="button"
                      :disabled="!meta?.hash"
                      class="grid place-items-center border-0 bg-transparent p-0 text-gray-400 transition-colors hover:text-gray-900 disabled:opacity-50 dark:text-gray-500 dark:hover:text-white"
                      :title="copied ? 'Copied' : 'Copy commit hash'"
                      @click="copyCommit"
                    >
                      <Icon
                        :name="copied ? 'i-lucide:check' : 'i-lucide:copy'"
                        class="h-3 w-3"
                        :class="copied ? 'text-emerald-600 dark:text-emerald-400' : ''"
                      />
                    </button>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">tenant</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="clientSite ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'"
                    />
                    <span
                      class="truncate"
                      :class="clientSite ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
                    >
                      {{ clientSite?.name || 'landing' }}
                    </span>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">db</dt>
                  <dd class="flex items-center gap-1.5">
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dbDot" />
                    <span class="font-mono text-gray-700 dark:text-gray-200">{{
                      health ? (health.db ? `${health.latency}ms` : 'down') : '…'
                    }}</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { DevView } from '~/composables/useDevView'

const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'
const headerBtn =
  'grid h-6 w-6 place-items-center rounded border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
const segGroup = 'gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800/60'
const seg = (active: boolean) =>
  active
    ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'

const views = [
  { id: 'auto', icon: 'i-lucide:wand-sparkles' },
  { id: 'landing', icon: 'i-lucide:globe' },
  { id: 'tenant', icon: 'i-lucide:building-2' },
] satisfies { id: DevView; icon: string }[]
const view = useDevView()
const activeView = computed(() => views.find((v) => v.id === view.value) ?? views[0]!)

const plans = ['BASIC', 'PRO', 'PREMIUM', 'CUSTOM'] as const

const { locale, setLocale } = useI18n()
const language = computed<Language>({
  get: () => locale.value as Language,
  set: (value) => setLocale(value),
})

const clientSite = await useClientSite()
const { data: meta } = useLazyFetch('/api/_dev/meta', { server: false })
const { data: health, refresh: refreshHealth } = useLazyFetch('/api/_dev/health', { server: false })
useIntervalFn(() => refreshHealth(), 5000)

const dbDot = computed(() => (health.value?.db ? 'bg-emerald-500' : 'bg-red-500'))
const commitUrl = computed(() =>
  meta.value?.remote && meta.value?.hashFull ? `${meta.value.remote}/commit/${meta.value.hashFull}` : '',
)

const { copy, copied } = useClipboard({ copiedDuring: 1200 })
const copyCommit = () => meta.value?.hashFull && copy(meta.value.hashFull)

const { data: auth, signIn } = useAuth()
const currentUser = computed(() => (auth.value as { user?: { email?: string } } | null)?.user?.email ?? 'guest')
const isGuest = computed(() => currentUser.value === 'guest')

const seedUsers = [
  { label: 'reader', email: 'reader@test.local', icon: 'i-lucide:eye' },
  { label: 'admin', email: 'admin@test.local', icon: 'i-lucide:shield' },
  { label: 'super', email: 'super@test.local', icon: 'i-lucide:crown' },
]
const busy = shallowRef(false)

const impersonate = async (email: string) => {
  if (currentUser.value === email) return
  busy.value = true
  try {
    await signIn('credentials', { email, password: 'test1234', redirect: false })
    reloadNuxtApp({ force: true })
  } catch {
    busy.value = false
  }
}

const switchPlan = async (plan: (typeof plans)[number]) => {
  if (!clientSite || clientSite.plan === plan) return
  busy.value = true
  try {
    await $fetch('/api/_dev/plan', { method: 'PATCH', body: { id: clientSite.id, plan } })
    reloadNuxtApp({ force: true })
  } catch {
    busy.value = false
  }
}

const panel = useTemplateRef<HTMLElement>('panel')
const handle = useTemplateRef<HTMLElement>('handle')

const visible = useLocalStorage('dev-console-visible', true)
const collapsed = useLocalStorage('dev-console-collapsed', false)
const position = useLocalStorage('dev-console-pos', { x: 12, y: 12 })

const { x, y, style, isDragging } = useDraggable(panel, {
  handle,
  initialValue: position.value,
  preventDefault: true,
})

const { width: vw, height: vh } = useWindowSize()
const MARGIN = 12
const settle = () => {
  const el = panel.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  x.value = x.value + w / 2 < vw.value / 2 ? MARGIN : Math.max(MARGIN, vw.value - w - MARGIN)
  y.value = Math.min(Math.max(MARGIN, y.value), Math.max(MARGIN, vh.value - h - MARGIN))
  position.value = { x: x.value, y: y.value }
}

watch(isDragging, (dragging) => !dragging && settle())
watch([vw, vh], settle)
watch(collapsed, () => nextTick(settle))
watch(visible, (v) => v && nextTick(settle))

const keys = useMagicKeys()
whenever(keys['Ctrl+Shift+D']!, () => (visible.value = !visible.value))
</script>
