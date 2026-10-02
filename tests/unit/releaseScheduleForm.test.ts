// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import { releaseScheduleSettings } from '../../shared/utils/releaseSchedule'
import ReleaseSchedule from '../../app/components/Form/Client/ReleaseSchedule.vue'

const global = { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })] }

const mount = (frequency: 'DAILY' | 'WEEKLY' | 'INTERVAL', overrides = {}) =>
  mountSuspended(ReleaseSchedule, {
    props: { frequency, schedule: { ...releaseScheduleSettings(), ...overrides } },
    global,
  })

describe('release schedule settings', () => {
  it('asks for a release hour on fixed rhythms and for a gap and window on irregular ones', async () => {
    const fixed = await mount('DAILY')
    expect(fixed.text()).toContain('common.preferences.releaseSchedule.releaseHour')
    expect(fixed.text()).not.toContain('common.preferences.releaseSchedule.window.label')

    const irregular = await mount('INTERVAL')
    expect(irregular.text()).toContain('common.preferences.releaseSchedule.interval.label')
    expect(irregular.text()).toContain('common.preferences.releaseSchedule.window.label')
  })

  it('shows a gap in the unit it was set in', async () => {
    const wrapper = await mount('INTERVAL', { intervalMinHours: 48, intervalMaxHours: 96 })
    const [min, max] = ['min', 'max'].map((end) =>
      wrapper.find(`input[aria-label="common.preferences.releaseSchedule.interval.${end}"]`),
    )
    expect((min!.element as HTMLInputElement).value).toBe('2')
    expect((max!.element as HTMLInputElement).value).toBe('4')
  })

  it('toggles a publishing day without touching the other rules', async () => {
    const wrapper = await mount('INTERVAL', { intervalMinHours: 12 })
    const monday = wrapper.findAll('button[aria-pressed]')[0]!
    await monday.trigger('click')

    const emitted = wrapper.emitted('update:schedule')?.at(-1)?.[0] as ReturnType<typeof releaseScheduleSettings>
    expect(emitted.releaseDays).toEqual([2, 3, 4, 5, 6, 7])
    expect(emitted.intervalMinHours).toBe(12)
  })

  it('explains an impossible schedule instead of previewing it', async () => {
    const wrapper = await mount('INTERVAL', { releaseDays: [] })
    expect(wrapper.text()).toContain('common.preferences.releaseSchedule.errors.releaseDays')
  })
})
