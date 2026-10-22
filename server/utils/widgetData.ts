import {
  CRYPTO,
  FIAT,
  type PriceConfig,
  type PriceData,
  type WeatherConfig,
  type WeatherData,
} from '~~/shared/utils/widgets'

// MET Norway and Nominatim refuse anonymous clients; both ask for an identifying User-Agent.
const USER_AGENT = 'Topiqu/1.0 (+https://topiqu.com)'
const fetchJson = <T>(url: string) => $fetch<T, string>(url, { timeout: 5000, headers: { 'user-agent': USER_AGENT } })

const isCrypto = (asset: string) => (CRYPTO as readonly string[]).includes(asset)

// ECB reference rates (Frankfurter) change once a day; one call covers every fiat pair for a quote currency.
const fiatRates = (quote: string) =>
  cached(`widget:fx:${quote}`, 3600, async () => {
    const symbols = FIAT.filter((code) => code !== quote).join(',')
    const res = await fetchJson<{ rates: Record<string, number> }>(
      `https://api.frankfurter.dev/v1/latest?base=${quote}&symbols=${symbols}`,
    )
    return res.rates
  })

// Coinbase public rates: one call per coin, priced in every currency.
const cryptoRates = (asset: string) =>
  cached(`widget:crypto:${asset}`, 300, async () => {
    const res = await fetchJson<{ data: { rates: Record<string, string> } }>(
      `https://api.coinbase.com/v2/exchange-rates?currency=${asset}`,
    )
    return res.data.rates
  })

/** One unit of each asset in the quote currency. An asset whose provider fails is left out, not zeroed. */
export const widgetQuotes = async ({ assets, quote }: PriceConfig): Promise<PriceData> => {
  const prices = await Promise.all(
    assets.map(async (asset) => {
      try {
        const value = isCrypto(asset) ? Number((await cryptoRates(asset))[quote]) : 1 / (await fiatRates(quote))[asset]!
        return Number.isFinite(value) && value > 0 ? { asset, value } : null
      } catch {
        return null
      }
    }),
  )
  return { quote, prices: prices.filter((price) => price !== null), asOf: new Date().toISOString() }
}

type MetSeries = {
  time: string
  data: {
    instant: { details: { air_temperature: number } }
    next_1_hours?: { summary: { symbol_code: string } }
    next_6_hours?: { summary: { symbol_code: string } }
  }
}

/**
 * MET Norway forecast reduced to now plus daily min/max. Days follow the place's mean solar time: no timezone
 * database, and a day boundary is off by an hour or two at most (DST, political zones).
 */
export const widgetForecast = ({ place, days }: WeatherConfig): Promise<WeatherData> => {
  // MET asks for at most four decimals; it also makes nearby widgets share one cache entry.
  const lat = place.lat.toFixed(4)
  const lon = place.lon.toFixed(4)
  const offset = Math.round(place.lon / 15) * 3_600_000
  return cached(`widget:weather:${lat},${lon}:${days}`, 1800, async () => {
    const res = await fetchJson<{ properties: { timeseries: MetSeries[] } }>(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
    )
    const series = res.properties.timeseries
    const now = series[0]
    const byDay = new Map<string, { min: number; max: number; symbol: string | null; noonGap: number }>()
    for (const point of series) {
      const local = new Date(Date.parse(point.time) + offset)
      const date = local.toISOString().slice(0, 10)
      const temp = point.data.instant.details.air_temperature
      const day = byDay.get(date) ?? { min: temp, max: temp, symbol: null, noonGap: Infinity }
      day.min = Math.min(day.min, temp)
      day.max = Math.max(day.max, temp)
      // The six-hour summary nearest local noon is the one a reader reads as "the day's weather"; later
      // MET steps are six hours apart, so noon itself is often missing.
      const symbol = point.data.next_6_hours?.summary.symbol_code
      const noonGap = Math.abs(local.getUTCHours() - 12)
      if (symbol && noonGap < day.noonGap) Object.assign(day, { symbol, noonGap })
      byDay.set(date, day)
    }
    return {
      current: now
        ? {
            temp: now.data.instant.details.air_temperature,
            symbol: now.data.next_1_hours?.summary.symbol_code ?? now.data.next_6_hours?.summary.symbol_code ?? null,
          }
        : null,
      days: [...byDay.entries()].slice(0, days).map(([date, { min, max, symbol }]) => ({ date, min, max, symbol })),
    }
  })
}

/** Place search for the weather editor; results are cached, and the route rate-limits per tenant. */
export const searchPlaces = (query: string, locale: string) =>
  cached(`widget:places:${locale}:${query.toLowerCase()}`, 86_400, async () => {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': locale })
    const res = await fetchJson<{ name: string; display_name: string; lat: string; lon: string }[]>(
      `https://nominatim.openstreetmap.org/search?${params}`,
    )
    return res.map((place) => ({
      name: place.name || place.display_name.split(',')[0]!,
      label: place.display_name,
      lat: Number(place.lat),
      lon: Number(place.lon),
    }))
  })
