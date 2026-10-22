import { vitalPage, webVitalsSampleRate } from '~~/shared/utils/webVitals'

export default defineNuxtPlugin((nuxtApp) => {
  const route = useRoute()
  const consent = useAnalyticsConsent()
  const config = useRuntimeConfig()
  const page = vitalPage(route.fullPath)
  if (
    config.public.appEnv !== 'production' ||
    config.public.browserTest ||
    !config.public.sentry.dsn ||
    !page ||
    Math.random() >= webVitalsSampleRate
  )
    return

  const device = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop'
  let registered = false
  let sensitiveNavigation = false
  watch(
    () => route.fullPath,
    (path) => {
      if (!vitalPage(path)) sensitiveNavigation = true
    },
    { flush: 'sync' },
  )
  const allowed = () => consent.value && !sensitiveNavigation && vitalPage(route.fullPath) !== null
  const stop = watch(
    consent,
    async (granted) => {
      if (!granted || registered || !allowed()) return
      registered = true
      try {
        const { reportWebVitals } = await import('~/utils/reportWebVitals')
        if (allowed()) reportWebVitals(page, device, allowed)
      } catch {
        // A blocked telemetry chunk must not interrupt navigation or publishing.
      }
    },
    { immediate: true },
  )
  nuxtApp.vueApp.onUnmount(stop)
})
