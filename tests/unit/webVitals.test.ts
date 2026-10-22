import { describe, expect, it, vi } from 'vitest'

import { createVitalReporter, scrubWebVitalMetric, vitalPage, webVitalTargets } from '../../shared/utils/webVitals'

describe('privacy-safe real user measurements', () => {
  it.each([
    ['/cs', 'home'],
    ['/en/articles/reader-story', 'article'],
    ['/cs/clanky/cesky-clanek', 'article'],
    ['/de/artikel/ein-artikel', 'article'],
    ['/fr/articles/article', 'article'],
    ['/cs/stitky/praha', 'collection'],
    ['/fr/auteur/nom', 'collection'],
    ['/en/admin/editor/private-id', 'editor'],
    ['/en/master/operations', 'dashboard'],
    ['/cs/settings', 'settings'],
  ])('groups %s without sending a raw route', (path, category) => {
    expect(vitalPage(path)).toBe(category)
  })

  it.each([
    '/en/auth',
    '/cs/autorizace',
    '/de/anmeldung',
    '/fr/connexion',
    '/en/auth-transfer?ticket=fixture',
    '/en/oauth-start',
    '/en/integrations-connect?request=fixture',
    '/en/invitation/private',
    '/en/articles/story?code=private',
    '/en?state=private',
    '/en?session=private',
    '/unknown',
  ])('excludes sensitive and unknown routes: %s', (path) => {
    expect(vitalPage(path)).toBeNull()
  })

  it('emits one distribution per metric and document visit, including a new BFCache visit', () => {
    const send = vi.fn()
    const report = createVitalReporter('article', 'mobile', () => true, send)
    report({ name: 'LCP', id: 'visit-one', value: 2400 })
    report({ name: 'LCP', id: 'visit-one', value: 2500 })
    report({ name: 'LCP', id: 'visit-two', value: 300 })
    report({ name: 'INP', id: 'inp-one', value: 180 })
    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[0]?.[0]).toEqual({
      name: 'web_vitals.lcp',
      value: 2400,
      unit: 'millisecond',
      attributes: { page_type: 'article', device_type: 'mobile', measurement: 'document', sample_rate: 0.1 },
    })
    expect(JSON.stringify(send.mock.calls)).not.toContain('visit-one')
  })

  it('checks consent on every observation and rejects invalid observations', () => {
    let consent = false
    const send = vi.fn()
    const report = createVitalReporter('home', 'desktop', () => consent, send)
    report({ name: 'CLS', id: 'cls', value: 0.08 })
    expect(send).not.toHaveBeenCalled()
    consent = true
    report({ name: 'CLS', id: 'cls', value: 0.08 })
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]?.[0].unit).toBe('none')
    consent = false
    report({ name: 'INP', id: 'inp', value: 100 })
    consent = true
    for (const value of [-1, NaN, Infinity]) report({ name: 'LCP', id: 'invalid', value })
    report({ name: 'FCP', id: 'not-cwv', value: 100 })
    expect(send).toHaveBeenCalledOnce()
  })

  it('removes SDK identity, URL and DOM enrichment before sending custom metrics', () => {
    const safe = scrubWebVitalMetric({
      name: 'web_vitals.inp',
      value: 123,
      attributes: {
        page_type: 'editor',
        device_type: 'desktop',
        'user.id': 'private',
        'user.email': 'private@example.invalid',
        'url.full': 'https://private.invalid?code=private',
        element: '<input value="private">',
      },
    })
    expect(safe?.attributes).toEqual({
      page_type: 'editor',
      device_type: 'desktop',
      measurement: 'document',
      sample_rate: 0.1,
    })
    expect(
      scrubWebVitalMetric({
        name: 'web_vitals.lcp',
        value: 2,
        attributes: { page_type: '/private', device_type: 'desktop' },
      }),
    ).toBeNull()
    expect(scrubWebVitalMetric({ name: 'web_vitals.secret', value: 1 })).toBeNull()
    expect(webVitalTargets).toEqual({ LCP: 2500, INP: 200, CLS: 0.1 })
  })
})
