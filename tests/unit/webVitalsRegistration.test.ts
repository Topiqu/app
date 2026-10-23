import { describe, expect, it, vi } from 'vitest'

import { reportWebVitals } from '../../app/utils/reportWebVitals'

const mocks = vi.hoisted(() => ({ lcp: vi.fn(), inp: vi.fn(), cls: vi.fn(), send: vi.fn() }))
vi.mock('web-vitals', () => ({ onLCP: mocks.lcp, onINP: mocks.inp, onCLS: mocks.cls }))
vi.mock('@sentry/nuxt', () => ({ metrics: { distribution: mocks.send } }))

describe('document Web Vitals registration', () => {
  it('opts out of soft navigations and rechecks consent for every final observation', () => {
    let allowed = true
    reportWebVitals('article', 'mobile', () => allowed)
    for (const register of [mocks.lcp, mocks.inp, mocks.cls])
      expect(register).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { reportSoftNavs: false })
    const callback = mocks.lcp.mock.calls[0]![0] as (metric: {
      name: string
      id: string
      value: number
      navigationType: string
      navigationURL?: string
    }) => void
    callback({
      name: 'LCP',
      id: 'soft-id',
      value: 100,
      navigationType: 'soft-navigation',
      navigationURL: 'https://private.invalid?token=secret',
    })
    expect(mocks.send).not.toHaveBeenCalled()
    callback({ name: 'LCP', id: 'document-id', value: 2400, navigationType: 'navigate' })
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith('web_vitals.lcp', 2400, {
      unit: 'millisecond',
      attributes: { page_type: 'article', device_type: 'mobile', measurement: 'document', sample_rate: 0.1 },
    })
    allowed = false
    callback({ name: 'LCP', id: 'later-id', value: 2000, navigationType: 'navigate' })
    expect(mocks.send).toHaveBeenCalledOnce()
  })
})
