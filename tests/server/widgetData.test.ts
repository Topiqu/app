import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CRYPTO, FIAT } from '../../shared/utils/widgets'

const load = async (responses: Record<string, unknown>) => {
  vi.resetModules()
  vi.unstubAllGlobals()
  const fetch = vi.fn(async (url: string) => {
    const hit = Object.entries(responses).find(([prefix]) => url.startsWith(prefix))
    if (!hit) throw new Error(`unexpected ${url}`)
    return hit[1]
  })
  vi.stubGlobal('$fetch', fetch)
  vi.stubGlobal('cached', (_key: string, _ttl: number, fn: () => unknown) => fn())
  vi.stubGlobal('CRYPTO', CRYPTO)
  vi.stubGlobal('FIAT', FIAT)
  return { ...(await import('../../server/utils/widgetData')), fetch }
}

describe('widgetQuotes', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('prices one unit of each asset in the quote currency', async () => {
    const { widgetQuotes } = await load({
      'https://api.frankfurter.dev/v1/latest?base=CZK': { rates: { EUR: 0.04 } },
      'https://api.coinbase.com/v2/exchange-rates?currency=BTC': { data: { rates: { CZK: '1500000.5' } } },
    })
    const { prices } = await widgetQuotes({ assets: ['EUR', 'BTC'], quote: 'CZK' })
    expect(prices).toEqual([
      { asset: 'EUR', value: 25 },
      { asset: 'BTC', value: 1500000.5 },
    ])
  })

  it('leaves out an asset whose provider fails instead of showing zero', async () => {
    const { widgetQuotes } = await load({ 'https://api.frankfurter.dev/v1/latest?base=EUR': { rates: { USD: 1.25 } } })
    const { prices } = await widgetQuotes({ assets: ['USD', 'ETH'], quote: 'EUR' })
    expect(prices).toEqual([{ asset: 'USD', value: 0.8 }])
  })
})

describe('widgetForecast', () => {
  const point = (time: string, temp: number, symbol?: string) => ({
    time,
    data: {
      instant: { details: { air_temperature: temp } },
      next_1_hours: symbol ? { summary: { symbol_code: symbol } } : undefined,
      next_6_hours: { summary: { symbol_code: symbol ?? 'cloudy' } },
    },
  })

  it('reduces the series to now plus daily min and max, rounding the coordinates it asks for', async () => {
    const { widgetForecast, fetch } = await load({
      'https://api.met.no/': {
        properties: {
          timeseries: [
            point('2026-10-08T10:00:00Z', 12, 'rain'),
            point('2026-10-08T11:00:00Z', 15, 'partlycloudy_day'),
            point('2026-10-09T06:00:00Z', 4),
            point('2026-10-09T12:00:00Z', 9, 'clearsky_day'),
          ],
        },
      },
    })
    const forecast = await widgetForecast({ place: { name: 'Brno', lat: 49.195061, lon: 16.606836 }, days: 2 })

    expect(fetch.mock.calls[0]?.[0]).toContain('lat=49.1951&lon=16.6068')
    expect(forecast.current).toEqual({ temp: 12, symbol: 'rain' })
    expect(forecast.days).toEqual([
      { date: '2026-10-08', min: 12, max: 15, symbol: 'partlycloudy_day' },
      { date: '2026-10-09', min: 4, max: 9, symbol: 'clearsky_day' },
    ])
  })

  it('splits days at the place’s local midnight, not at UTC midnight', async () => {
    const { widgetForecast } = await load({
      'https://api.met.no/': {
        properties: {
          timeseries: [
            point('2026-10-08T18:00:00Z', 20, 'clearsky_day'),
            point('2026-10-09T06:00:00Z', 14, 'rain'),
            point('2026-10-09T12:00:00Z', 22, 'cloudy'),
          ],
        },
      },
    })
    // Honolulu is ten to eleven hours behind UTC: 06:00Z on the 9th is still the evening of the 8th there.
    const forecast = await widgetForecast({ place: { name: 'Honolulu', lat: 21.3, lon: -157.86 }, days: 2 })

    expect(forecast.days).toEqual([
      { date: '2026-10-08', min: 14, max: 20, symbol: 'clearsky_day' },
      { date: '2026-10-09', min: 22, max: 22, symbol: 'cloudy' },
    ])
  })
})
