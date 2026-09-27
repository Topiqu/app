<template>
  <UInputDate
    :id
    :modelValue="value"
    :granularity="time ? 'minute' : 'day'"
    :minValue
    :maxValue
    :disabled
    class="w-full"
    @update:modelValue="update($event as DateValue | undefined)"
  >
    <template #trailing>
      <UPopover v-model:open="open" :content="{ align: 'end' }">
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="mdi:calendar"
          :aria-label="$t('common.actions.pickDate')"
          :disabled
          :ui="{ base: 'px-0' }"
        />
        <template #content>
          <UCalendar
            :modelValue="value && toCalendarDate(value)"
            :minValue
            :maxValue
            preventDeselect
            :ui="{ root: 'p-2' }"
            @update:modelValue="pick($event as DateValue | undefined)"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>

<script setup lang="ts">
import {
  getLocalTimeZone,
  now,
  toCalendarDate,
  toCalendarDateTime,
  toTime,
  type DateValue,
} from '@internationalized/date'

const props = defineProps<{
  modelValue?: string | null
  time?: boolean
  min?: string
  max?: string
  id?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = shallowRef(false)

const value = computed(() => parseDateInput(props.modelValue, props.time))
const minValue = computed(() => parseDateInput(props.min, props.time))
const maxValue = computed(() => parseDateInput(props.max, props.time))

const update = (date: DateValue | undefined) => emit('update:modelValue', formatDateInput(date, props.time))

// Picking a day keeps the typed time; with none yet, it starts from the current time of day.
const pick = (date: DateValue | undefined) => {
  open.value = false
  if (!date) return
  const time = value.value && 'hour' in value.value ? toTime(value.value) : toTime(now(getLocalTimeZone()))
  emit('update:modelValue', formatDateInput(props.time ? toCalendarDateTime(date, time) : date, props.time))
}
</script>
