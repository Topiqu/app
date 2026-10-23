import { metrics } from '@sentry/nuxt'
import { onCLS, onINP, onLCP } from 'web-vitals'
import { createVitalReporter, type VitalDevice, type VitalPage } from '~~/shared/utils/webVitals'

export const reportWebVitals = (page: VitalPage, device: VitalDevice, allowed: () => boolean) => {
  const report = createVitalReporter(page, device, allowed, (metric) => {
    metrics.distribution(metric.name, metric.value, { unit: metric.unit, attributes: metric.attributes })
  })
  // These budgets measure the initial document; SPA visits need separate attribution.
  onLCP(report, { reportSoftNavs: false })
  onINP(report, { reportSoftNavs: false })
  onCLS(report, { reportSoftNavs: false })
}
