<template>
  <section
    class="@container overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    aria-labelledby="agency-blogs-title"
  >
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-5 py-4">
      <div class="min-w-0">
        <h2 id="agency-blogs-title" class="font-semibold text-highlighted">{{ $t('agency.blogs.title') }}</h2>
        <p class="mt-0.5 text-sm text-muted">
          {{
            live ? $t('agency.blogs.period') : $t('agency.blogs.slots', { used: slots.paid, total: agency.blogSlots })
          }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UDropdownMenu v-if="periods.length > 1" :items="reports">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="mdi:tray-arrow-down"
            trailingIcon="mdi:chevron-down"
          >
            {{ $t('agency.blogs.report') }}
          </UButton>
        </UDropdownMenu>
        <UButton
          v-else-if="blogs.length || periods.length"
          to="/api/agency/report"
          external
          download
          color="neutral"
          variant="outline"
          size="sm"
          icon="mdi:tray-arrow-down"
        >
          {{ $t('agency.blogs.report') }}
        </UButton>
        <UButton v-if="owner && live" size="sm" icon="mdi:plus" @click="createOpen = true">
          {{ $t('agency.blogs.create') }}
        </UButton>
      </div>
    </header>

    <div v-if="!blogs.length" class="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <span class="flex size-11 items-center justify-center rounded-full bg-elevated text-muted" aria-hidden="true">
        <UIcon name="mdi:web" class="size-5" />
      </span>
      <p class="max-w-sm text-sm text-muted">{{ $t(live ? 'agency.blogs.empty' : 'agency.blogs.emptyInactive') }}</p>
    </div>
    <LazyTenantCreate v-if="createMounted" v-model="createOpen" :agencyPlan="attachPlan" />
    <ul v-else class="divide-y divide-default">
      <li
        v-for="blog in rows"
        :key="blog.id"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 px-5 py-5 @xl:grid-cols-[minmax(0,1fr)_minmax(12rem,17rem)_auto] @xl:gap-x-10"
      >
        <div class="flex min-w-0 items-center gap-3.5">
          <UAvatar
            :text="initialsOf(blog.name)"
            :alt="blog.name"
            size="lg"
            class="shrink-0"
            :ui="{ root: 'bg-primary/10', fallback: 'font-semibold text-primary' }"
          />
          <div class="min-w-0">
            <p class="flex min-w-0 items-center gap-2">
              <span class="truncate font-medium text-highlighted">{{ blog.name }}</span>
              <UBadge v-bind="PLAN_BADGES[blog.plan]" size="sm" class="shrink-0">
                {{ $t(`agency.plans.${blog.plan}`) }}
              </UBadge>
            </p>
            <p class="flex min-w-0 items-center gap-x-2 text-sm text-muted">
              <span class="truncate">{{ blog.domain }}</span>
              <span aria-hidden="true">·</span>
              <span class="shrink-0 tabular-nums">
                {{ $t('agency.blogs.articles', { count: blog.published }, blog.published) }}
              </span>
            </p>
          </div>
        </div>
        <div class="col-span-2 flex flex-col gap-2 @xl:col-span-1">
          <div class="flex items-baseline justify-between gap-4">
            <p class="flex items-baseline gap-1.5">
              <span class="text-lg font-semibold leading-none tabular-nums text-highlighted">{{ blog.usedLabel }}</span>
              <span class="text-sm text-muted">{{ $t('agency.blogs.credits', blog.unitsUsed) }}</span>
            </p>
            <span class="text-xs tabular-nums text-muted">{{ blog.detail }}</span>
          </div>
          <UProgress
            :modelValue="blog.progress"
            :max="100"
            size="xs"
            :color="blog.monthlyUnitLimit ? (blog.progress >= 90 ? 'warning' : 'primary') : 'neutral'"
            :aria-label="blog.ariaLabel"
          />
        </div>
        <div v-if="owner" class="col-start-2 row-start-1 justify-self-end @xl:col-start-3">
          <UDropdownMenu :items="actions(blog)" :content="{ align: 'end' }" :ui="{ content: 'w-72' }">
            <UButton
              color="neutral"
              variant="ghost"
              square
              icon="mdi:dots-horizontal"
              :loading="detaching === blog.id || planning === blog.id"
              :aria-label="$t('agency.blogs.actionsFor', { blog: blog.name })"
            />
          </UDropdownMenu>
        </div>
      </li>
    </ul>

    <form
      v-if="owner && live"
      class="border-t border-default bg-elevated/40 px-5 py-4"
      @submit.prevent="selected && attach({ clientSiteId: selected, plan: attachPlan })"
    >
      <UFormField
        :label="$t('agency.blogs.attachLabel')"
        :help="freeSlots ? $t('agency.blogs.attachHelp') : $t('agency.blogs.noFreeSlot')"
        name="attach"
      >
        <div class="flex flex-col gap-2 @md:flex-row">
          <USelect
            v-model="selected"
            :items="attachItems"
            :placeholder="$t('agency.blogs.attachPlaceholder')"
            :disabled="!attachItems.length"
            class="min-w-0 flex-1"
          />
          <USelect v-model="attachPlan" :items="attachPlans" :aria-label="$t('agency.blogs.plan')" class="@md:w-40" />
          <UButton
            type="submit"
            icon="mdi:plus"
            :loading="attaching"
            :disabled="!selected || !!shortfall(attachPlan)"
            :ui="{ base: 'justify-center' }"
          >
            {{ $t('agency.blogs.attach') }}
          </UButton>
        </div>
      </UFormField>
    </form>
    <ul v-if="owner && blocked.length" class="space-y-1 border-t border-default px-5 py-3 text-xs text-muted">
      <li v-for="blog in blocked" :key="blog.id" class="flex gap-2">
        <UIcon name="mdi:information-outline" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ $t(`agency.blogs.blocked.${blog.blocked}`, { blog: blog.name }) }}
      </li>
    </ul>

    <UModal
      v-model:open="limitOpen"
      :title="$t('agency.blogs.limitFor', { blog: editing?.name ?? '' })"
      :description="$t('agency.blogs.limitHelp')"
    >
      <template #body>
        <form id="agency-limit-form" @submit.prevent="editing && limitDraft && saveLimit(editing.id, limitDraft)">
          <UFormField :label="$t('agency.blogs.limitLabel')" name="limit">
            <UInputNumber v-model="limitDraft" :min="1" :max="100000" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="limiting || editing?.monthlyUnitLimit == null"
            @click="editing && saveLimit(editing.id, null)"
          >
            {{ $t('agency.blogs.removeLimit') }}
          </UButton>
          <UButton type="submit" form="agency-limit-form" :loading="limiting" :disabled="!limitDraft">
            {{ $t('agency.blogs.saveLimit') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AgencyBlogPlan } from '~~/shared/utils/agencyPlan'

import type { AgencyAccount, AgencyAttachableBlog, AgencyBlog, AgencyPeriod } from '~/composables/useAgency'

const { agency, blogs, slots, attachable, periods } = defineProps<{
  agency: AgencyAccount
  /** Live blogs only; a deleted blog takes no slot. */
  blogs: AgencyBlog[]
  slots: { paid: number; premium: number }
  attachable: AgencyAttachableBlog[]
  periods: AgencyPeriod[]
  owner: boolean
  live: boolean
}>()

const PLAN_ORDER: AgencyBlogPlan[] = ['PREMIUM', 'PRO', 'BASIC']
const PLAN_BADGES = {
  PREMIUM: { color: 'primary', variant: 'subtle' },
  PRO: { color: 'neutral', variant: 'subtle' },
  BASIC: { color: 'neutral', variant: 'outline' },
} as const satisfies Record<AgencyBlogPlan, { color: string; variant: string }>
// A step down turns features off that do not come back on by themselves.
const DOWNGRADES: Partial<Record<AgencyBlogPlan, { title: string; text: string }>> = {
  BASIC: { title: 'agency.blogs.toFreeTitle', text: 'agency.blogs.toFreeText' },
  PRO: { title: 'agency.blogs.toProTitle', text: 'agency.blogs.toProText' },
}

const { t, locale } = useI18n()
const confirm = useConfirm()
const selected = shallowRef<string | undefined>()
const limitOpen = shallowRef(false)
const editing = shallowRef<AgencyBlog | null>(null)
const limitDraft = shallowRef<number | null>(null)
const detaching = shallowRef<string | null>(null)
const planning = shallowRef<string | null>(null)
const createOpen = shallowRef(false)
// Mounted on first use: the wizard loads its own data, which most visits never need.
const createMounted = computed<boolean>((previous) => Boolean(previous || createOpen.value))

const freeSlots = computed(() => Math.max(agency.blogSlots - slots.paid, 0))
// The server's own rule, so a disabled choice here is exactly what it would refuse.
const SHORTFALL_HINTS = { NO_FREE_SLOT: 'agency.blogs.noSlot', NO_FREE_PREMIUM_SLOT: 'agency.blogs.noPremiumSlot' }
const shortfall = (plan: AgencyBlogPlan, blogId?: string) => {
  const code = agencySlotShortfall(agency, [
    ...blogs.filter((blog) => blog.id !== blogId).map((blog) => blog.plan),
    plan,
  ])
  return code ? t(SHORTFALL_HINTS[code]) : null
}
const attachPlan = shallowRef<AgencyBlogPlan>('PRO')
watch(freeSlots, (free) => (attachPlan.value = free ? 'PRO' : 'BASIC'), { immediate: true })
const attachPlans = computed(() =>
  PLAN_ORDER.map((plan) => ({ label: t(`agency.plans.${plan}`), value: plan, disabled: !!shortfall(plan) })),
)
const attachItems = computed(() =>
  attachable
    .filter((blog) => !blog.blocked)
    .map((blog) => ({ label: `${blog.name} · ${blog.domain}`, value: blog.id })),
)
const blocked = computed(() => attachable.filter((blog) => blog.blocked))

// One report per billing period; a blog that left the agency still shows what it spent in it.
const reports = computed((): DropdownMenuItem[][] => {
  const dates = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' })
  return periods.length > 1
    ? [
        [
          { type: 'label', label: t('agency.blogs.reportPeriod') },
          ...periods.map((period) => ({
            label: period.end
              ? dates.formatRange(new Date(period.start), new Date(period.end))
              : dates.format(new Date(period.start)),
            icon: 'mdi:file-delimited-outline',
            to: `/api/agency/report?period=${encodeURIComponent(period.start)}`,
            external: true,
          })),
        ],
      ]
    : []
})

// Without a limit the bar shows the blog's share of the agency's spend this period.
const rows = computed(() => {
  const number = new Intl.NumberFormat(locale.value)
  const total = blogs.reduce((sum, blog) => sum + blog.unitsUsed, 0)
  return blogs.map((blog) => {
    const share = total ? Math.round((blog.unitsUsed / total) * 100) : 0
    const usedLabel = number.format(blog.unitsUsed)
    const detail = blog.monthlyUnitLimit
      ? t('agency.blogs.ofLimit', { limit: number.format(blog.monthlyUnitLimit) })
      : t('agency.blogs.ofAgency', { share })
    return {
      ...blog,
      progress: blog.monthlyUnitLimit
        ? Math.min(100, Math.round((blog.unitsUsed / blog.monthlyUnitLimit) * 100))
        : share,
      usedLabel,
      detail,
      ariaLabel: `${blog.name}: ${usedLabel} ${t('agency.blogs.credits', blog.unitsUsed)}, ${detail}`,
    }
  })
})

const actions = (blog: AgencyBlog): DropdownMenuItem[][] => [
  [
    { type: 'label', label: t('agency.blogs.plan') },
    ...PLAN_ORDER.map((plan): DropdownMenuItem => {
      const blocked = plan === blog.plan ? null : shortfall(plan, blog.id)
      return {
        type: 'checkbox',
        label: t(`agency.plans.${plan}`),
        description: blocked ?? t(`agency.planHints.${plan}`),
        checked: plan === blog.plan,
        disabled: !!blocked,
        ui: { itemDescription: 'whitespace-normal' },
        onUpdateChecked: (checked: boolean) => {
          if (checked && plan !== blog.plan) changePlan(blog, plan)
        },
      }
    }),
  ],
  [
    { label: t('agency.blogs.setLimit'), icon: 'mdi:speedometer', onSelect: () => openLimit(blog) },
    { label: t('agency.blogs.openSite'), icon: 'mdi:open-in-new', to: `https://${blog.domain}`, target: '_blank' },
  ],
  [{ label: t('agency.blogs.detach'), icon: 'mdi:link-variant-off', color: 'error', onSelect: () => detach(blog) }],
]

const { mutate: attach, isLoading: attaching } = useAgencyMutation(
  async (body: { clientSiteId: string; plan: AgencyBlogPlan }) => {
    await $fetch<unknown, '/api/agency/blogs'>('/api/agency/blogs', { method: 'POST', body })
    selected.value = undefined
  },
  'agency.blogs.attached',
)
const { mutate: setLimit, isLoading: limiting } = useAgencyMutation(
  async ({ id, monthlyUnitLimit }: { id: string; monthlyUnitLimit: number | null }) => {
    await $fetch<unknown, '/api/agency/blogs/:id'>(`/api/agency/blogs/${id}` as '/api/agency/blogs/:id', {
      method: 'PATCH',
      body: { monthlyUnitLimit },
    })
    limitOpen.value = false
  },
  'agency.blogs.limitSaved',
)
const { mutateAsync: setPlan } = useAgencyMutation(
  ({ id, plan }: { id: string; plan: AgencyBlogPlan }) =>
    $fetch<unknown, '/api/agency/blogs/:id'>(`/api/agency/blogs/${id}` as '/api/agency/blogs/:id', {
      method: 'PATCH',
      body: { plan },
    }),
  'agency.blogs.planSaved',
)
const { mutateAsync: remove } = useAgencyMutation(
  (id: string) =>
    $fetch<unknown, '/api/agency/blogs/:id'>(`/api/agency/blogs/${id}` as '/api/agency/blogs/:id', {
      method: 'DELETE',
    }),
  'agency.blogs.detached',
)

const openLimit = (blog: AgencyBlog) => {
  editing.value = blog
  limitDraft.value = blog.monthlyUnitLimit
  limitOpen.value = true
}
const saveLimit = (id: string, monthlyUnitLimit: number | null) => setLimit({ id, monthlyUnitLimit })
const changePlan = async (blog: AgencyBlog, plan: AgencyBlogPlan) => {
  const downgrade = PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(blog.plan) ? DOWNGRADES[plan] : undefined
  if (
    downgrade &&
    !(await confirm({
      title: t(downgrade.title, { blog: blog.name }),
      message: t(downgrade.text),
      icon: 'mdi:arrow-down-circle-outline',
      confirmText: t('agency.blogs.changePlan'),
      cancelText: t('common.messages.deleteCancel'),
      variant: 'danger',
    }))
  )
    return
  planning.value = blog.id
  await setPlan({ id: blog.id, plan }).catch(() => undefined)
  planning.value = null
}
const detach = async (blog: AgencyBlog) => {
  const confirmed = await confirm({
    title: t('agency.blogs.detachTitle', { blog: blog.name }),
    message: t('agency.blogs.detachText'),
    icon: 'mdi:link-variant-off',
    confirmText: t('agency.blogs.detach'),
    cancelText: t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (!confirmed) return
  detaching.value = blog.id
  await remove(blog.id).catch(() => undefined)
  detaching.value = null
}
</script>
