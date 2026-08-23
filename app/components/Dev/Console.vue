<template>
  <ClientOnly>
    <Teleport to="body">
      <UButton
        v-if="!visible"
        color="neutral"
        variant="ghost"
        type="button"
        square
        icon="i-mdi-console"
        class="fixed bottom-4 left-4 z-devtools"
        aria-label="Open DevConsole"
        data-dev-console
        @click="visible = true"
      />

      <UCard
        v-else
        ref="panel"
        role="complementary"
        aria-label="DevConsole"
        data-dev-console
        class="fixed z-devtools w-96 max-w-[calc(100vw-1rem)] select-none overflow-hidden max-sm:inset-x-2 max-sm:bottom-2 max-sm:w-auto"
        :style="panelStyle"
      >
        <div
          class="flex touch-none items-center justify-between gap-2 border-b border-default px-3 py-2 sm:cursor-move"
          @pointerdown="startDrag"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <UIcon name="i-mdi-drag-vertical" size="16" class="-ml-1 shrink-0" />
            <template v-if="collapsed">
              <span class="flex min-w-0 items-center gap-1.5 text-[10px] font-medium">
                <UIcon :name="activeView.icon" size="12" class="shrink-0" />
                <span class="truncate text-highlighted">{{ clientSite?.name || 'landing' }}</span>
                <template v-if="clientSite">
                  <span class="text-muted">·</span>
                  <UBadge color="info" variant="soft" size="xs">{{ clientSite.plan }}</UBadge>
                </template>
                <UChip :color="health?.db ? 'success' : 'error'" standalone size="3xl" title="db" />
                <UChip v-if="meta?.dirty" color="warning" standalone size="3xl" title="uncommitted changes" />
              </span>
            </template>
            <template v-else>
              <UIcon name="i-mdi-console" size="14" class="shrink-0" />
              <span class="text-xs font-semibold text-highlighted">DevConsole</span>
            </template>
          </span>
          <span class="flex shrink-0 items-center gap-0.5">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              square
              size="xs"
              :icon="collapsed ? 'i-mdi-chevron-down' : 'i-mdi-chevron-up'"
              :aria-label="collapsed ? 'Expand' : 'Collapse'"
              @pointerdown.stop
              @click="collapsed = !collapsed"
            />
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              square
              size="xs"
              icon="i-mdi-close"
              aria-label="Hide DevConsole"
              @pointerdown.stop
              @click="visible = false"
            />
          </span>
        </div>

        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out"
          :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
        >
          <div class="overflow-hidden">
            <div class="max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto px-3 py-3">
              <section class="space-y-1.5">
                <p class="text-xs font-medium uppercase tracking-wider text-muted">Render view</p>
                <div class="grid grid-cols-3 gap-1">
                  <UButton
                    v-for="v in views"
                    :key="v.id"
                    :color="view === v.id ? 'primary' : 'neutral'"
                    :variant="view === v.id ? 'solid' : 'ghost'"
                    type="button"
                    :icon="v.icon"
                    @click="view = v.id"
                  >
                    {{ v.id }}
                  </UButton>
                </div>
                <UAlert
                  v-if="view !== 'auto'"
                  color="warning"
                  variant="soft"
                  icon="i-mdi-alert"
                  :description="`forcing ${view} - overrides resolver`"
                />
              </section>

              <section v-if="clientSite" class="space-y-1.5 border-t border-default pt-3">
                <p class="text-xs font-medium uppercase tracking-wider text-muted">Plan</p>
                <div class="grid grid-cols-2 gap-1">
                  <UButton
                    v-for="p in plans"
                    :key="p"
                    :color="clientSite.plan === p ? 'primary' : 'neutral'"
                    :variant="clientSite.plan === p ? 'solid' : 'ghost'"
                    type="button"
                    :disabled="busy"
                    @click="switchPlan(p)"
                  >
                    {{ p }}
                  </UButton>
                </div>
              </section>

              <section class="space-y-1.5 border-t border-default pt-3">
                <p class="text-xs font-medium uppercase tracking-wider text-muted">Impersonate</p>
                <div class="grid grid-cols-3 gap-1">
                  <UButton
                    v-for="u in seedUsers"
                    :key="u.email"
                    :color="currentUser === u.email ? 'primary' : 'neutral'"
                    :variant="currentUser === u.email ? 'solid' : 'ghost'"
                    type="button"
                    :icon="u.icon"
                    :disabled="busy"
                    @click="impersonate(u.email)"
                  >
                    {{ u.label }}
                  </UButton>
                </div>
                <p class="flex items-start gap-1 text-xs text-muted">
                  <UIcon size="12" :name="isGuest ? 'i-mdi-account-off' : 'i-mdi-account-check'" class="shrink-0" />
                  <span class="min-w-0 break-all font-mono text-highlighted">{{ currentUser }}</span>
                </p>
              </section>

              <section class="space-y-1.5 border-t border-default pt-3">
                <p class="text-xs font-medium uppercase tracking-wider text-muted">Locale</p>
                <LangSwitcher v-model:language="language" class="w-full" />
              </section>

              <dl class="space-y-1.5 border-t border-default pt-3 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <dt class="text-muted">branch</dt>
                  <dd class="min-w-0 break-all text-right font-mono text-highlighted">
                    {{ meta?.branch || '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">commit</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <UBadge v-if="meta?.dirty" color="warning" variant="soft" size="sm" title="uncommitted changes">
                      dirty
                    </UBadge>
                    <ULink
                      v-if="commitUrl"
                      :href="commitUrl"
                      target="_blank"
                      rel="noopener"
                      title="Open commit on remote"
                    >
                      <span class="font-mono">{{ meta?.hash }}</span>
                    </ULink>
                    <span v-else class="font-mono text-highlighted">{{ meta?.hash || '-' }}</span>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      type="button"
                      :disabled="!meta?.hash"
                      square
                      :icon="copied ? 'i-mdi-check' : 'i-mdi-content-copy'"
                      :title="copied ? 'Copied' : 'Copy commit hash'"
                      @click="copyCommit"
                    />
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">tenant</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <UChip :color="clientSite ? 'success' : 'neutral'" standalone size="3xl" />
                    <span class="min-w-0 break-words" :class="clientSite ? 'text-highlighted' : 'text-muted'">
                      {{ clientSite?.name || 'landing' }}
                    </span>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">db</dt>
                  <dd class="flex items-center gap-1.5">
                    <UChip :color="health?.db ? 'success' : 'error'" standalone size="3xl" />
                    <span class="font-mono text-highlighted">{{
                      health ? (health.db ? `${health.latency}ms` : 'down') : '…'
                    }}</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </UCard>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { DevView } from '~/composables/useDevView'

const views = [
  { id: 'auto', icon: 'i-mdi-auto-fix' },
  { id: 'tenant', icon: 'i-mdi-office-building' },
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

const commitUrl = computed(() =>
  meta.value?.remote && meta.value?.hashFull ? `${meta.value.remote}/commit/${meta.value.hashFull}` : '',
)

const { copy, copied } = useClipboard({ copiedDuring: 1200 })
const copyCommit = () => meta.value?.hashFull && copy(meta.value.hashFull)

const { data: auth, signIn, getSession } = useAuth()
const currentUser = computed(() => (auth.value as { user?: { email?: string } } | null)?.user?.email ?? 'guest')
const isGuest = computed(() => currentUser.value === 'guest')

const seedUsers = [
  { label: 'reader', email: 'reader@test.local', icon: 'i-mdi-eye' },
  { label: 'admin', email: 'admin@test.local', icon: 'i-mdi-shield-account' },
  { label: 'super', email: 'super@test.local', icon: 'i-mdi-crown' },
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
    await getSession()
    reloadNuxtApp({ force: true })
  } catch {
    busy.value = false
  }
}

const visible = useLocalStorage('dev-console-visible', true)
const collapsed = useLocalStorage('dev-console-collapsed', true)
type ConsolePosition = { x: number; y: number }
type ViewportCategory = 'desktop' | 'tablet'
const storedPositions = useLocalStorage<Partial<Record<ViewportCategory, ConsolePosition>>>(
  'dev-console-position-v1',
  {},
)
const panel = useTemplateRef<{ $el: HTMLElement }>('panel')
const viewportWidth = useState('dev-console-viewport-width', () => 0)
const position = shallowRef<ConsolePosition>({ x: 304, y: 80 })
const viewportCategory = computed<ViewportCategory>(() => (viewportWidth.value >= 1024 ? 'desktop' : 'tablet'))
const isMobile = computed(() => viewportWidth.value < 640)

const clampPosition = (candidate: ConsolePosition): ConsolePosition => {
  const element = panel.value?.$el
  return clampDevConsolePosition(
    candidate,
    { width: window.innerWidth, height: window.innerHeight },
    { width: element?.offsetWidth || 240, height: element?.offsetHeight || 64 },
  )
}

const restorePosition = () => {
  if (isMobile.value) return
  const fallback = viewportCategory.value === 'desktop' ? { x: 304, y: 80 } : { x: 16, y: 80 }
  position.value = clampPosition(
    readDevConsolePosition(storedPositions.value, viewportCategory.value, fallback) as ConsolePosition,
  )
}

const panelStyle = computed(() =>
  isMobile.value ? undefined : { left: `${position.value.x}px`, top: `${position.value.y}px` },
)

const startDrag = (event: PointerEvent) => {
  if (isMobile.value || event.button !== 0) return
  const origin = { ...position.value }
  const pointer = { x: event.clientX, y: event.clientY }
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  const move = (moveEvent: PointerEvent) => {
    position.value = clampPosition({
      x: origin.x + moveEvent.clientX - pointer.x,
      y: origin.y + moveEvent.clientY - pointer.y,
    })
  }
  const stop = () => {
    storedPositions.value = { ...storedPositions.value, [viewportCategory.value]: position.value }
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', stop)
    target.removeEventListener('pointercancel', stop)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', stop)
  target.addEventListener('pointercancel', stop)
}

const updateViewport = () => {
  viewportWidth.value = window.innerWidth
  nextTick(restorePosition)
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', updateViewport))
watch([visible, collapsed], () => nextTick(restorePosition))

const keys = useMagicKeys()
whenever(keys['Ctrl+Shift+D']!, () => (visible.value = !visible.value))
</script>
