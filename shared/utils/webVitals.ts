import { LOCALIZED_SEGMENTS } from './routes'
import budgets from '../../performance-budgets.json'

export const webVitalTargets = budgets.fieldP75
export const webVitalsSampleRate = budgets.rumSampleRate

export type VitalPage = 'home' | 'article' | 'collection' | 'editor' | 'dashboard' | 'settings'
export type VitalDevice = 'mobile' | 'desktop'

export const vitalPage = (input: string): VitalPage | null => {
  const url = new URL(input, 'https://telemetry.invalid')
  if ([...url.searchParams.keys()].some((key) => /token|code|proof|state|key|email|session|callback|verify/i.test(key)))
    return null
  const path = url.pathname.replace(/^\/(en|cs|de|fr)(?=\/|$)/, '').replace(/\/$/, '') || '/'
  if (path === '/') return 'home'
  const [, segment, value, ...rest] = path.split('/')
  if (value && !rest.length) {
    if (Object.values(LOCALIZED_SEGMENTS.article).some((candidate) => candidate === segment)) return 'article'
    if (
      [...Object.values(LOCALIZED_SEGMENTS.author), ...Object.values(LOCALIZED_SEGMENTS.tag)].some(
        (candidate) => candidate === segment,
      )
    )
      return 'collection'
  }
  if (/^\/admin\/editor\/[^/]+$/.test(path)) return 'editor'
  if (/^\/settings(?:\/|$)/.test(path)) return 'settings'
  if (/^\/(admin|master)(?:\/|$)/.test(path) || path === '/drafts') return 'dashboard'
  return null
}

interface VitalObservation {
  name: string
  id: string
  value: number
}

export interface VitalDistribution {
  name: string
  value: number
  unit: 'millisecond' | 'none'
  attributes: { page_type: VitalPage; device_type: VitalDevice; measurement: 'document'; sample_rate: number }
}

export const createVitalReporter = (
  page: VitalPage,
  device: VitalDevice,
  allowed: () => boolean,
  send: (metric: VitalDistribution) => void,
) => {
  const reported = new Map<string, string>()
  return (metric: VitalObservation) => {
    if (
      !allowed() ||
      !Object.hasOwn(webVitalTargets, metric.name) ||
      !Number.isFinite(metric.value) ||
      metric.value < 0
    )
      return
    if (reported.get(metric.name) === metric.id) return
    reported.set(metric.name, metric.id)
    send({
      name: `web_vitals.${metric.name.toLowerCase()}`,
      value: metric.value,
      unit: metric.name === 'CLS' ? 'none' : 'millisecond',
      attributes: { page_type: page, device_type: device, measurement: 'document', sample_rate: webVitalsSampleRate },
    })
  }
}

/** Sentry enriches metrics with identity and browser fields before this hook. Keep only our coarse dimensions. */
export const scrubWebVitalMetric = <T extends { name: string; value: number; attributes?: Record<string, unknown> }>(
  metric: T,
): T | null => {
  if (!metric.name.startsWith('web_vitals.')) return metric
  if (
    !['web_vitals.lcp', 'web_vitals.inp', 'web_vitals.cls'].includes(metric.name) ||
    !Number.isFinite(metric.value) ||
    metric.value < 0
  )
    return null
  const attributes = metric.attributes ?? {}
  if (
    !['home', 'article', 'collection', 'editor', 'dashboard', 'settings'].includes(String(attributes.page_type)) ||
    !['mobile', 'desktop'].includes(String(attributes.device_type))
  )
    return null
  return {
    ...metric,
    attributes: {
      page_type: attributes.page_type,
      device_type: attributes.device_type,
      measurement: 'document',
      sample_rate: webVitalsSampleRate,
    },
  }
}
