<template>
  <ClientOnly>
    <Teleport to="body">
      <button
        v-if="!visible"
        type="button"
        class="fixed bottom-4 left-4 z-[99999] grid h-9 w-9 place-items-center rounded-full bg-gray-950/85 text-emerald-400 shadow-lg ring-1 ring-white/15 backdrop-blur-md transition-transform hover:scale-110"
        aria-label="Open DevConsole"
        @click="visible = true"
      >
        <Icon name="i-lucide:terminal" class="h-4 w-4" />
      </button>

      <section
        v-else
        ref="panel"
        :style="style"
        class="fixed z-[99999] w-64 select-none overflow-hidden rounded-2xl border border-white/10 bg-gray-950/85 text-gray-100 shadow-2xl shadow-black/60 ring-1 ring-black/40 backdrop-blur-xl"
        :class="{ 'transition-[left,top] duration-300 ease-out': !isDragging }"
      >
        <div class="h-0.5 w-full bg-gradient-to-r" :class="accent" />

        <header
          ref="handle"
          class="flex cursor-grab items-center justify-between gap-2 px-3.5 py-2.5 active:cursor-grabbing"
        >
          <span class="flex items-center gap-2">
            <Icon name="i-lucide:grip-vertical" class="-ml-1 h-4 w-4 text-gray-600" />
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span class="text-xs font-semibold tracking-tight text-white">DevConsole</span>
          </span>
          <span class="flex items-center gap-0.5">
            <button
              type="button"
              class="grid h-6 w-6 place-items-center rounded-lg bg-transparent text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              :aria-label="collapsed ? 'Expand' : 'Collapse'"
              @click="collapsed = !collapsed"
            >
              <Icon
                name="i-lucide:chevron-down"
                class="h-4 w-4 transition-transform duration-300"
                :class="collapsed ? '' : 'rotate-180'"
              />
            </button>
            <button
              type="button"
              class="grid h-6 w-6 place-items-center rounded-lg bg-transparent text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Hide DevConsole"
              @click="visible = false"
            >
              <Icon name="i-lucide:x" class="h-4 w-4" />
            </button>
          </span>
        </header>

        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out"
          :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
        >
          <div class="overflow-hidden">
            <div class="space-y-4 px-3.5 pb-3.5">
              <div class="space-y-2">
                <p class="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">Render view</p>
                <div class="relative grid grid-cols-3 rounded-xl bg-black/40 p-1 ring-1 ring-white/5">
                  <div
                    class="absolute bottom-1 top-1 rounded-lg bg-white shadow-md transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    :style="pillStyle"
                  />
                  <button
                    v-for="v in views"
                    :key="v"
                    type="button"
                    class="relative z-10 rounded-lg px-2 py-1.5 text-center text-[11px] capitalize bg-transparent transition-colors duration-200"
                    :class="view === v ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-200'"
                    @click="view = v"
                  >
                    {{ v }}
                  </button>
                </div>
                <Transition
                  enterActiveClass="transition duration-200 ease-out"
                  leaveActiveClass="transition duration-150 ease-in"
                  enterFromClass="opacity-0 -translate-y-1"
                  leaveToClass="opacity-0 -translate-y-1"
                >
                  <p v-if="view !== 'auto'" class="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <Icon name="i-lucide:triangle-alert" class="h-3 w-3 shrink-0" />
                    forcing <b class="font-semibold">{{ view }}</b> — overrides resolver
                  </p>
                </Transition>
              </div>

              <div class="space-y-2 border-t border-white/10 pt-3">
                <p class="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">Impersonate</p>
                <div class="grid grid-cols-3 gap-1.5">
                  <button
                    v-for="u in seedUsers"
                    :key="u.email"
                    type="button"
                    :disabled="busy"
                    class="rounded-lg px-2 py-1.5 text-[11px] capitalize bg-white/5 text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    @click="impersonate(u.email)"
                  >
                    {{ u.label }}
                  </button>
                </div>
                <p class="truncate text-[10px] text-gray-500">
                  session: <span class="font-mono text-gray-300">{{ currentUser }}</span>
                </p>
              </div>

              <dl class="space-y-2 border-t border-white/10 pt-3 text-[11px]">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500">branch</dt>
                  <dd class="truncate text-right font-mono text-gray-200">{{ meta?.branch || '—' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500">commit</dt>
                  <dd class="flex items-center gap-1.5 font-mono text-gray-200">
                    {{ meta?.hash || '—' }}
                    <span
                      v-if="meta?.dirty"
                      class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px] shadow-amber-400/60"
                      title="uncommitted changes"
                    />
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500">tenant</dt>
                  <dd class="flex items-center gap-1.5 truncate text-right">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="clientSite ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60' : 'bg-gray-600'"
                    />
                    <span class="truncate" :class="clientSite ? 'text-gray-200' : 'text-gray-500'">
                      {{ clientSite?.name || 'landing' }}
                    </span>
                  </dd>
                </div>
                <div v-if="clientSite" class="flex items-center justify-between gap-2">
                  <dt class="text-gray-500">plan</dt>
                  <dd
                    class="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-300 ring-1 ring-white/10"
                  >
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

import { themes, type ThemeKey } from '~/composables/theme'

const views: DevView[] = ['auto', 'landing', 'tenant']
const view = useDevView()
const activeIndex = computed(() => Math.max(0, views.indexOf(view.value)))
const pillStyle = computed(() => ({
  width: 'calc((100% - 0.5rem) / 3)',
  left: `calc(0.25rem + ${activeIndex.value} * ((100% - 0.5rem) / 3))`,
}))

const clientSite = await useClientSite()
const { data: meta } = useFetch('/api/_dev/meta', { lazy: true, server: false })

const themeKey = ((clientSite?.theme as ThemeKey) in themes ? clientSite!.theme : 'blue') as ThemeKey
const accent = themes[themeKey]

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
