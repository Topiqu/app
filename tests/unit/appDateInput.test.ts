// @vitest-environment nuxt

import { nextTick } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'

import AppDateInput from '../../app/components/AppDateInput.vue'
import UCalendar from '../../node_modules/@nuxt/ui/dist/runtime/components/Calendar.vue'
import UInputDate from '../../node_modules/@nuxt/ui/dist/runtime/components/InputDate.vue'

enableAutoUnmount(afterEach)

const mount = (props: Record<string, unknown>) =>
  mountSuspended(AppDateInput, { props, global: { mocks: { $t: (key: string) => key } } })

const openCalendar = async (wrapper: Awaited<ReturnType<typeof mount>>) => {
  await wrapper.get('button[aria-label]').trigger('click')
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 30))
  return wrapper.getComponent(UCalendar)
}

describe('AppDateInput', () => {
  it('hands the native string to the field as a date value', async () => {
    const wrapper = await mount({ modelValue: '2026-09-27T14:30', time: true })
    const field = wrapper.getComponent(UInputDate)

    expect(field.props('modelValue')).toEqual(new CalendarDateTime(2026, 9, 27, 14, 30))
    expect(field.props('granularity')).toBe('minute')
  })

  it('emits the native format when the field is typed into or cleared', async () => {
    const wrapper = await mount({ modelValue: '2026-09-27' })
    const field = wrapper.getComponent(UInputDate)

    field.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 1))
    field.vm.$emit('update:modelValue', undefined)
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-01'], ['']])
  })

  it('keeps the typed time when a day is picked from the calendar', async () => {
    const wrapper = await mount({ modelValue: '2026-09-27T14:30', time: true })
    const calendar = await openCalendar(wrapper)

    calendar.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 3))
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-03T14:30']])
  })

  it('picks a plain day in date mode and passes the bounds through', async () => {
    const wrapper = await mount({ modelValue: '', max: '2026-09-27' })
    expect(wrapper.getComponent(UInputDate).props('maxValue')).toEqual(new CalendarDate(2026, 9, 27))

    const calendar = await openCalendar(wrapper)
    expect(calendar.props('maxValue')).toEqual(new CalendarDate(2026, 9, 27))
    calendar.vm.$emit('update:modelValue', new CalendarDate(2026, 9, 1))
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-09-01']])
  })
})
