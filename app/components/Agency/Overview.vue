<template>
  <section
    class="@container overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    :aria-label="$t('agency.overview.label')"
  >
    <div class="grid divide-y divide-default @xl:grid-cols-3 @xl:divide-x @xl:divide-y-0">
      <div v-for="meter in meters" :key="meter.key" class="flex flex-col gap-3 p-5">
        <p class="flex items-center gap-2 text-sm text-muted">
          <UIcon :name="meter.icon" class="size-4 shrink-0" aria-hidden="true" />
          {{ meter.label }}
        </p>
        <p
          class="text-3xl font-semibold tracking-tight tabular-nums"
          :class="meter.muted ? 'text-muted' : 'text-highlighted'"
        >
          {{ meter.value }}<span v-if="meter.suffix" class="text-lg font-medium text-muted">{{ meter.suffix }}</span>
        </p>
        <UProgress
          :modelValue="meter.progress"
          :max="100"
          size="xs"
          :color="meter.warn ? 'warning' : 'primary'"
          :aria-label="meter.label"
        />
        <p class="text-xs leading-5 text-muted">{{ meter.note }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AgencyAccount, AgencyBlog } from '~/composables/useAgency'

const { agency, blogs, slots, available, aiBudgetLeft } = defineProps<{
  agency: AgencyAccount
  blogs: AgencyBlog[]
  slots: { paid: number; premium: number }
  available: number
  aiBudgetLeft: number | null
}>()

const { t, locale } = useI18n()

const meters = computed(() => {
  const number = new Intl.NumberFormat(locale.value)
  const monthly = agencyUnits(agency.unitBlocks)
  const used = blogs.reduce((sum, blog) => sum + blog.unitsUsed, 0)
  const free = Math.max(agency.blogSlots - slots.paid, 0)
  const percent = (part: number, whole: number) => (whole ? Math.min(100, Math.round((part / whole) * 100)) : 0)
  return [
    {
      key: 'credits',
      icon: 'mdi:star-four-points-outline',
      label: t('agency.overview.credits'),
      value: number.format(available),
      suffix: '',
      progress: percent(used, monthly),
      warn: used >= monthly * 0.9,
      note: t('agency.overview.creditsNote', { used: number.format(used), monthly: number.format(monthly) }),
      muted: false,
    },
    {
      key: 'ai',
      icon: 'mdi:robot-outline',
      label: t('agency.overview.ai'),
      value: aiBudgetLeft == null ? '—' : number.format(aiBudgetLeft),
      suffix: aiBudgetLeft == null ? '' : ' %',
      progress: aiBudgetLeft ?? 0,
      warn: aiBudgetLeft != null && aiBudgetLeft < 15,
      note: t('agency.overview.aiNote'),
      muted: aiBudgetLeft == null,
    },
    {
      key: 'slots',
      icon: 'mdi:web',
      label: t('agency.overview.slots'),
      value: number.format(slots.paid),
      suffix: ` / ${number.format(agency.blogSlots)}`,
      progress: percent(slots.paid, agency.blogSlots),
      warn: !free,
      note: agency.premiumSlots
        ? t('agency.overview.slotsPremiumNote', {
            free: number.format(free),
            used: number.format(slots.premium),
            total: number.format(agency.premiumSlots),
          })
        : t('agency.overview.slotsNote', { free: number.format(free) }),
      muted: false,
    },
  ]
})
</script>
