<template>
  <ClientOnly>
    <Teleport to="body">
      <button
        v-if="!visible"
        type="button"
        class="fixed bottom-4 left-4 z-[99999] grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-md transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        aria-label="Open DevConsole"
        @click="visible = true"
      >
        <Icon name="i-lucide:terminal" class="h-4 w-4" />
      </button>

      <section
        v-else
        ref="panel"
        :style="style"
        class="fixed z-[99999] w-60 select-none overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        :class="{ 'transition-[left,top] duration-300 ease-out': !isDragging }"
      >
        <header
          ref="handle"
          class="flex cursor-grab items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 active:cursor-grabbing dark:border-gray-800"
        >
          <span class="flex items-center gap-1.5">
            <Icon name="i-lucide:grip-vertical" class="-ml-1 h-4 w-4 text-gray-400 dark:text-gray-600" />
            <Icon name="i-lucide:terminal" class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
            <span class="text-xs font-semibold text-gray-900 dark:text-gray-100">DevConsole</span>
          </span>
          <span class="flex items-center gap-0.5">
            <button
              type="button"
              class="grid h-6 w-6 place-items-center rounded border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              :aria-label="collapsed ? 'Expand' : 'Collapse'"
              @click="collapsed = !collapsed"
            >
              <Icon name="i-lucide:chevron-down" class="h-4 w-4 transition-transform" :class="collapsed ? '' : 'rotate-180'" />
            </button>
            <button
              type="button"
              class="grid h-6 w-6 place-items-center rounded border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              aria-label="Hide DevConsole"
              @click="visible = false"
            >
              <Icon name="i-lucide:x" class="h-4 w-4" />
            </button>
          </span>
        </header>

        <div class="grid transition-[grid-template-rows] duration-300 ease-out" :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'">
          <div class="overflow-hidden">
            <div class="space-y-3 px-3 py-3">
              <div class="space-y-1.5">
                <p class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Render view</p>
                <div class="grid grid-cols-3 gap-1">
                  <button
                    v-for="v in views"
                    :key="v"
                    type="button"
                    class="rounded-md border-0 px-2 py-1 text-[11px] capitalize transition-colors"
                    :class="
                      view === v
                        ? 'bg-gray-900 font-semibold text-white dark:bg-gray-100 dark:text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
                    "
                    @click="view = v"
                  >
                    {{ v }}
                  </button>
                </div>
                <p
                  v-if="view !== 'auto'"
                  class="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <Icon name="i-lucide:triangle-alert" class="h-3 w-3 shrink-0" />
                  forcing <b class="font-semibold">{{ view }}</b> — overrides resolver
                </p>
              </div>

              <div class="space-y-1.5 border-t border-gray-200 pt-3 dark:border-gray-800">
                <p class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Impersonate</p>
                <div class="grid grid-cols-3 gap-1">
                  <button
                    v-for="u in seedUsers"
                    :key="u.email"
                    type="button"
                    :disabled="busy"
                    class="rounded-md border-0 px-2 py-1 text-[11px] capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    :class="
                      currentUser === u.email
                        ? 'bg-sky-600 font-medium text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    "
                    @click="impersonate(u.email)"
                  >
                    {{ u.label }}
                  </button>
                </div>
                <p class="truncate text-[10px] text-gray-500 dark:text-gray-400">
                  session: <span class="font-mono text-gray-700 dark:text-gray-200">{{ currentUser }}</span>
                </p>
              </div>

              <dl class="space-y-1.5 border-t border-gray-200 pt-3 text-[11px] dark:border-gray-800">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">branch</dt>
                  <dd class="truncate text-right font-mono text-gray-700 dark:text-gray-200">{{ meta?.branch || '—' }}</dd>
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
                    <button
                      type="button"
                      :disabled="!meta?.hash"
                      class="flex items-center gap-1 border-0 bg-transparent font-mono text-gray-700 transition-colors hover:text-gray-900 disabled:opacity-50 dark:text-gray-200 dark:hover:text-white"
                      :title="copied ? 'Copied' : 'Copy commit hash'"
                      @click="copyCommit"
                    >
                      {{ meta?.hash || '—' }}
                      <Icon
                        :name="copied ? 'i-lucide:check' : 'i-lucide:copy'"
                        class="h-3 w-3"
                        :class="copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'"
                      />
                    </button>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">tenant</dt>
                  <dd class="flex min-w-0 items-center gap-1.5">
                    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="clientSite ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'" />
                    <span class="truncate" :class="clientSite ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'">
                      {{ clientSite?.name || 'landing' }}
                    </span>
                  </dd>
                </div>
                <div v-if="clientSite" class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500 dark:text-gray-400">plan</dt>
                  <dd class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {{ clientSite.plan }}
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

const views: DevView[] = ['auto', 'landing', 'tenant']
const view = useDevView()

const clientSite = await useClientSite()
const { data: meta } = useFetch('/api/_dev/meta', { lazy: true, server: false })

const { copy, copied } = useClipboard({ copiedDuring: 1200 })
const copyCommit = () => meta.value?.hashFull && copy(meta.value.hashFull)

const { data: auth, signIn } = useAuth()
const currentUser = computed(() => (auth.value as { user?: { email?: string } } | null)?.user?.email ?? 'guest')

const seedUsers = [
  { label: 'reader', email: 'reader@test.local' },
  { label: 'admin', email: 'admin@test.local' },
  { label: 'super', email: 'super@test.local' },
]
const busy = shallowRef(false)
const impersonate = async (email: string) => {
  busy.value = true
  try {
    await signIn('credentials', { email, password: 'test1234', redirect: false })
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
