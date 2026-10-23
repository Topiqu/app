<template>
  <div class="@container space-y-4">
    <div>
      <UFormField :label="$t('common.preferences.generationFrequency.label')">
        <URadioGroup
          v-model="frequency"
          :items="frequencyOptions"
          :name="frequencyName"
          variant="segmented"
          indicator="hidden"
          orientation="horizontal"
          :aria-describedby="`${frequencyName}-description`"
        />
      </UFormField>
      <p :id="`${frequencyName}-description`" class="mt-2 text-xs leading-5 text-muted">{{ frequencyDescription }}</p>
    </div>

    <div class="grid gap-4 @lg:grid-cols-2">
      <template v-if="frequency === 'INTERVAL'">
        <UFormField
          :label="$t('common.preferences.releaseSchedule.interval.label')"
          :hint="$t('common.preferences.releaseSchedule.interval.minimum', { hours: MIN_INTERVAL_HOURS })"
        >
          <div
            class="rounded-(--ui-radius) bg-default ring ring-inset ring-accented focus-within:ring-2 focus-within:ring-primary"
          >
            <UFieldGroup class="w-full">
              <UInputNumber
                v-model="intervalMin"
                :min="unitMin"
                :max="unitMax"
                :increment="false"
                :decrement="false"
                variant="none"
                :ui="{ base: 'h-10' }"
                class="min-w-0 flex-1"
                :aria-label="$t('common.preferences.releaseSchedule.interval.min')"
              />
              <span class="flex items-center text-sm text-muted" aria-hidden="true">–</span>
              <UInputNumber
                v-model="intervalMax"
                :min="intervalMin"
                :max="unitMax"
                :increment="false"
                :decrement="false"
                variant="none"
                :ui="{ base: 'h-10' }"
                class="min-w-0 flex-1"
                :aria-label="$t('common.preferences.releaseSchedule.interval.max')"
              />
              <div class="w-28 shrink-0 border-l border-default">
                <USelect
                  v-model="unit"
                  :items="unitOptions"
                  variant="none"
                  class="w-full"
                  :aria-label="$t('common.preferences.releaseSchedule.interval.unit')"
                />
              </div>
            </UFieldGroup>
          </div>
        </UFormField>
        <UFormField :label="$t('common.preferences.releaseSchedule.window.label')">
          <div
            class="rounded-(--ui-radius) bg-default ring ring-inset ring-accented focus-within:ring-2 focus-within:ring-primary"
          >
            <UFieldGroup class="w-full">
              <USelect
                v-model="windowStart"
                :items="releaseHours"
                variant="none"
                class="min-w-0 flex-1"
                :aria-label="$t('common.preferences.releaseSchedule.window.from')"
              />
              <span class="flex items-center text-sm text-muted" aria-hidden="true">–</span>
              <USelect
                v-model="windowEnd"
                :items="windowEndHours"
                variant="none"
                class="min-w-0 flex-1"
                :aria-label="$t('common.preferences.releaseSchedule.window.to')"
              />
            </UFieldGroup>
          </div>
        </UFormField>
      </template>
      <UFormField v-else :label="$t('common.preferences.releaseSchedule.releaseHour')">
        <USelect
          v-model="releaseHour"
          :items="releaseHours"
          class="w-full"
          :aria-label="$t('common.preferences.releaseSchedule.releaseHour')"
        />
      </UFormField>

      <fieldset class="min-w-0 space-y-2" :class="frequency === 'INTERVAL' && '@lg:col-span-2'">
        <legend class="text-sm font-medium text-default">{{ $t('common.preferences.releaseSchedule.days') }}</legend>
        <div class="grid max-w-sm grid-cols-7 gap-1.5">
          <UButton
            v-for="day in weekdays"
            :key="day.value"
            square
            color="neutral"
            :variant="schedule.releaseDays.includes(day.value) ? 'soft' : 'outline'"
            class="w-full min-w-0"
            :aria-pressed="schedule.releaseDays.includes(day.value)"
            :aria-label="day.name"
            @click="toggleDay(day.value)"
          >
            {{ day.label }}
          </UButton>
        </div>
      </fieldset>
    </div>

    <details class="group" :open="invalid === 'timeZone'">
      <summary
        class="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md text-sm text-default outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden"
      >
        <span class="shrink-0 font-medium">{{ $t('common.preferences.releaseSchedule.advanced') }}</span>
        <span class="ml-auto min-w-0 truncate text-xs text-muted group-open:hidden">{{ timeZone }}</span>
        <UIcon
          name="mdi:chevron-down"
          class="size-4 shrink-0 text-muted group-open:ml-auto group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div class="space-y-2 pt-2">
        <UFormField :label="$t('common.preferences.releaseSchedule.timeZone')">
          <USelectMenu
            v-model="timeZone"
            :items="timeZones"
            virtualize
            class="w-full sm:max-w-sm"
            :aria-label="$t('common.preferences.releaseSchedule.timeZone')"
          />
        </UFormField>
      </div>
    </details>

    <UAlert
      v-if="invalid"
      color="error"
      variant="soft"
      icon="mdi:alert-circle-outline"
      :title="$t(`common.preferences.releaseSchedule.errors.${invalid}`)"
    />
    <ClientOnly v-else>
      <FormClientReleaseSchedulePreview
        :rules="rules"
        :articlesRemaining="articlesRemaining"
        :nextReleaseAt="nextReleaseAt"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { ReleaseFrequency, ReleaseScheduleSettings } from '~~/shared/utils/releaseSchedule'

const { articlesRemaining = null, nextReleaseAt = null } = defineProps<{
  articlesRemaining?: number | null
  /** Saved slot; the page passes null while the schedule has unsaved edits. */
  nextReleaseAt?: string | null
}>()
const frequency = defineModel<ReleaseFrequency>('frequency', { required: true })
const schedule = defineModel<ReleaseScheduleSettings>('schedule', { required: true })

const { t, locale } = useI18n()
const frequencyName = useId()

// The page hands over a fresh object on every read, so edits replace it instead of mutating it.
const field = <K extends keyof ReleaseScheduleSettings>(key: K) =>
  computed({
    get: () => schedule.value[key],
    set: (value: ReleaseScheduleSettings[K]) => (schedule.value = { ...schedule.value, [key]: value }),
  })
const releaseHour = field('releaseHour')
const windowStart = field('releaseWindowStart')
const windowEnd = field('releaseWindowEnd')
const timeZone = field('timeZone')

const UNIT_HOURS = { hours: 1, days: 24, weeks: 168 } as const
type Unit = keyof typeof UNIT_HOURS
const unitOf = (...hours: number[]): Unit =>
  hours.every((value) => value % 168 === 0) ? 'weeks' : hours.every((value) => value % 24 === 0) ? 'days' : 'hours'

const unit = shallowRef<Unit>(unitOf(schedule.value.intervalMinHours, schedule.value.intervalMaxHours))
const unitMin = computed(() => Math.max(1, Math.ceil(MIN_INTERVAL_HOURS / UNIT_HOURS[unit.value])))
const unitMax = computed(() => Math.floor(MAX_INTERVAL_HOURS / UNIT_HOURS[unit.value]))
const unitOptions = computed(() =>
  (Object.keys(UNIT_HOURS) as Unit[]).map((value) => ({
    value,
    label: t(`common.preferences.releaseSchedule.interval.units.${value}`),
  })),
)

const inUnit = (hours: number) => Math.max(unitMin.value, Math.round(hours / UNIT_HOURS[unit.value]))
const intervalMin = computed({
  get: () => inUnit(schedule.value.intervalMinHours),
  set: (value: number | null) => {
    const hours = Math.max(MIN_INTERVAL_HOURS, (value ?? unitMin.value) * UNIT_HOURS[unit.value])
    schedule.value = {
      ...schedule.value,
      intervalMinHours: hours,
      intervalMaxHours: Math.max(hours, schedule.value.intervalMaxHours),
    }
  },
})
const intervalMax = computed({
  get: () => inUnit(schedule.value.intervalMaxHours),
  set: (value: number | null) => {
    const hours = Math.max(schedule.value.intervalMinHours, (value ?? unitMin.value) * UNIT_HOURS[unit.value])
    schedule.value = { ...schedule.value, intervalMaxHours: hours }
  },
})
// Switching the unit keeps the numbers the author sees: "2–4" days becomes "2–4" weeks.
watch(unit, (next, previous) => {
  const factor = UNIT_HOURS[next] / UNIT_HOURS[previous]
  const min = Math.min(
    MAX_INTERVAL_HOURS,
    Math.max(MIN_INTERVAL_HOURS, Math.round(schedule.value.intervalMinHours * factor)),
  )
  const max = Math.min(MAX_INTERVAL_HOURS, Math.max(min, Math.round(schedule.value.intervalMaxHours * factor)))
  schedule.value = { ...schedule.value, intervalMinHours: min, intervalMaxHours: max }
})

const frequencyOptions = computed(() =>
  (['DAILY', 'WEEKLY', 'INTERVAL'] as const).map((value) => ({
    value,
    label: t(`common.preferences.generationFrequency.options.${value}`),
  })),
)
const frequencyDescription = computed(() =>
  t(`common.preferences.generationFrequency.optionDescriptions.${frequency.value}`),
)

const hourOptions = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    value: from + i,
    label: `${String(from + i).padStart(2, '0')}:00`,
  }))
const releaseHours = hourOptions(0, 23)
const windowEndHours = hourOptions(1, 24)

// 1 January 2024 was a Monday, so day i is ISO weekday i + 1.
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i))
    return {
      value: i + 1,
      label: new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(date),
      name: new Intl.DateTimeFormat(locale.value, { weekday: 'long', timeZone: 'UTC' }).format(date),
    }
  }),
)
const toggleDay = (day: number) => {
  const days = schedule.value.releaseDays
  schedule.value = {
    ...schedule.value,
    releaseDays: days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort((a, b) => a - b),
  }
}

const timeZones = computed(() => {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes(schedule.value.timeZone) ? zones : [schedule.value.timeZone, ...zones]
})

const rules = computed(() => ({ ...schedule.value, frequency: frequency.value }))
const invalid = computed(() => releaseScheduleError(rules.value))
</script>
