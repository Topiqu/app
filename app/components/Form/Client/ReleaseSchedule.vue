<template>
  <div class="space-y-5">
    <div>
      <h4 class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.generationFrequency.label') }}</h4>
      <p class="mt-1 text-sm leading-5 text-muted">{{ $t('common.preferences.generationFrequency.description') }}</p>
    </div>

    <UFormField :label="$t('common.preferences.generationFrequency.label')" :ui="{ label: 'sr-only' }">
      <URadioGroup
        v-model="frequency"
        :items="frequencyOptions"
        variant="card"
        :ui="{ fieldset: 'grid gap-3 sm:grid-cols-3', item: 'rounded-(--topiqu-surface-radius)' }"
      />
    </UFormField>

    <div v-if="frequency === 'INTERVAL'" class="grid gap-5 lg:grid-cols-2">
      <UFormField
        :label="$t('common.preferences.releaseSchedule.interval.label')"
        :help="$t('common.preferences.releaseSchedule.interval.help', { hours: MIN_INTERVAL_HOURS })"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UInputNumber
            v-model="intervalMin"
            :min="unitMin"
            :max="unitMax"
            class="w-28"
            :aria-label="$t('common.preferences.releaseSchedule.interval.min')"
          />
          <span class="text-muted" aria-hidden="true">–</span>
          <UInputNumber
            v-model="intervalMax"
            :min="intervalMin"
            :max="unitMax"
            class="w-28"
            :aria-label="$t('common.preferences.releaseSchedule.interval.max')"
          />
          <USelect
            v-model="unit"
            :items="unitOptions"
            class="w-32"
            :aria-label="$t('common.preferences.releaseSchedule.interval.unit')"
          />
        </div>
      </UFormField>
      <UFormField :label="$t('common.preferences.releaseSchedule.window.label')">
        <div class="flex items-center gap-2">
          <USelect
            v-model="windowStart"
            :items="hourOptions(0, 23)"
            class="w-28"
            :aria-label="$t('common.preferences.releaseSchedule.window.from')"
          />
          <span class="text-muted" aria-hidden="true">–</span>
          <USelect
            v-model="windowEnd"
            :items="hourOptions(1, 24)"
            class="w-28"
            :aria-label="$t('common.preferences.releaseSchedule.window.to')"
          />
        </div>
      </UFormField>
    </div>
    <UFormField v-else :label="$t('common.preferences.releaseSchedule.releaseHour')">
      <USelect v-model="releaseHour" :items="hourOptions(0, 23)" class="w-28" />
    </UFormField>

    <fieldset class="space-y-2">
      <legend class="text-sm font-medium text-default">{{ $t('common.preferences.releaseSchedule.days') }}</legend>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="day in weekdays"
          :key="day.value"
          size="sm"
          :color="schedule.releaseDays.includes(day.value) ? 'primary' : 'neutral'"
          :variant="schedule.releaseDays.includes(day.value) ? 'solid' : 'outline'"
          :aria-pressed="schedule.releaseDays.includes(day.value)"
          :aria-label="day.name"
          @click="toggleDay(day.value)"
        >
          {{ day.label }}
        </UButton>
      </div>
    </fieldset>

    <UFormField :label="$t('common.preferences.releaseSchedule.timeZone')">
      <USelectMenu v-model="timeZone" :items="timeZones" virtualize class="w-full sm:w-80" />
    </UFormField>

    <UAlert
      v-if="invalid"
      color="error"
      variant="soft"
      icon="mdi:alert-circle-outline"
      :title="$t(`common.preferences.releaseSchedule.errors.${invalid}`)"
    />

    <ClientOnly v-else>
      <section
        class="space-y-3 rounded-(--topiqu-surface-radius) border border-default bg-elevated/50 p-4"
        :aria-label="$t('common.preferences.releaseSchedule.preview')"
      >
        <p v-if="nextReleaseAt" class="text-sm font-medium text-highlighted">
          {{ $t('common.preferences.releaseSchedule.next', { date: formatSlot(new Date(nextReleaseAt)) }) }}
        </p>
        <div>
          <h5 class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{
              frequency === 'INTERVAL'
                ? $t('common.preferences.releaseSchedule.previewInterval')
                : $t('common.preferences.releaseSchedule.preview')
            }}
          </h5>
          <ul class="mt-2 space-y-1 text-sm text-default">
            <li v-for="slot in preview" :key="slot.getTime()">{{ formatSlot(slot) }}</li>
          </ul>
        </div>
        <p class="text-sm text-muted">
          {{ $t('common.preferences.releaseSchedule.perMonth', forecast.perMonth) }}
          <template v-if="articlesRemaining === 0">· {{ $t('common.preferences.releaseSchedule.noCredits') }}</template>
          <template v-else-if="forecast.creditsLastUntil">
            ·
            {{
              $t('common.preferences.releaseSchedule.creditsUntil', {
                date: formatSlot(forecast.creditsLastUntil, { day: 'numeric', month: 'long' }),
              })
            }}
          </template>
        </p>
      </section>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import {
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
  releaseForecast,
  releaseScheduleError,
  seededRandom,
  upcomingReleases,
  type ReleaseFrequency,
  type ReleaseScheduleSettings,
} from '~~/shared/utils/releaseSchedule'

const { articlesRemaining = null, nextReleaseAt = null } = defineProps<{
  articlesRemaining?: number | null
  /** Saved slot; the page passes null while the schedule has unsaved edits. */
  nextReleaseAt?: string | null
}>()
const frequency = defineModel<ReleaseFrequency>('frequency', { required: true })
const schedule = defineModel<ReleaseScheduleSettings>('schedule', { required: true })

const { t, locale } = useI18n()

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
    description: t(`common.preferences.generationFrequency.optionDescriptions.${value}`),
  })),
)

const hourOptions = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    value: from + i,
    label: `${String(from + i).padStart(2, '0')}:00`,
  }))

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

// Seeded by the rules, so the example slots stay put until the author changes something.
const seed = computed(() =>
  [...JSON.stringify(rules.value)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7),
)
const preview = computed(() => upcomingReleases(rules.value, { count: 4, random: seededRandom(seed.value) }))
const forecast = computed(() => releaseForecast(rules.value, articlesRemaining))

const formatSlot = (date: Date, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat(locale.value, {
    timeZone: schedule.value.timeZone,
    ...(Object.keys(options).length
      ? options
      : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
  }).format(date)
</script>
