import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { platformAdsEnabledForPlan, tenantGamEnabled } from '../../shared/utils/advertising'
import {
  CONSENT_VERSION,
  consentLauncherFor,
  consentCapabilities,
  consentCovers,
  createConsentDecision,
  hasAnalyticsConsent,
  hasMarketingConsent,
} from '../../shared/utils/consent'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('tenant consent capabilities', () => {
  it('offers first-party view statistics on every tenant publication', () => {
    expect(consentCapabilities({ plan: 'BASIC' })).toEqual({
      analytics: true,
      googleAnalytics: false,
      marketing: true,
    })
  })

  it('only exposes Google Analytics when the tenant configuration can really load it', () => {
    expect(consentCapabilities({ plan: 'PRO', allowGtag: true, gtagId: 'G-TENANT123' }).googleAnalytics).toBe(true)
    expect(consentCapabilities({ plan: 'BASIC', allowGtag: true, gtagId: 'G-TENANT123' }).googleAnalytics).toBe(false)
    expect(consentCapabilities({ plan: 'PRO', allowGtag: false, gtagId: 'G-TENANT123' }).googleAnalytics).toBe(false)
    expect(consentCapabilities({ plan: 'PRO', allowGtag: true, gtagId: 'not-a-ga-id' }).googleAnalytics).toBe(false)
  })

  it('offers marketing only for BASIC platform ads or a configured tenant GAM', () => {
    expect(consentCapabilities({ plan: 'BASIC' }).marketing).toBe(true)
    expect(consentCapabilities({ plan: 'PRO' }).marketing).toBe(false)
    expect(consentCapabilities({ plan: 'PRO', gamNetworkCode: '123456' }).marketing).toBe(true)
  })
})

describe('advertising plan policy', () => {
  it('requires advertising on BASIC and disables it on every other plan', () => {
    expect(platformAdsEnabledForPlan('BASIC')).toBe(true)
    expect(platformAdsEnabledForPlan('PRO')).toBe(false)
    expect(platformAdsEnabledForPlan('PREMIUM')).toBe(false)
    expect(platformAdsEnabledForPlan('CUSTOM')).toBe(false)
    expect(platformAdsEnabledForPlan(null)).toBe(false)
  })

  it('enables a tenant-owned GAM on any plan only when a network code exists', () => {
    expect(tenantGamEnabled('123456')).toBe(true)
    expect(tenantGamEnabled('  ')).toBe(false)
    expect(tenantGamEnabled(null)).toBe(false)
  })
})

describe('stored consent', () => {
  const analyticsOnly = { analytics: true, googleAnalytics: false, marketing: false }

  it('normalizes unavailable choices and records the configuration shown to the visitor', () => {
    const decision = createConsentDecision(
      analyticsOnly,
      { analytics: true, marketing: true },
      '2026-08-24T12:00:00.000Z',
    )

    expect(decision).toEqual({
      version: CONSENT_VERSION,
      analytics: true,
      marketing: false,
      services: { internalAnalytics: true, googleAnalytics: false, marketing: false },
      decidedAt: '2026-08-24T12:00:00.000Z',
    })
    expect(hasAnalyticsConsent(decision)).toBe(true)
    expect(hasMarketingConsent(decision)).toBe(false)
    expect(consentCovers(decision, analyticsOnly)).toBe(true)
  })

  it('asks again when the tenant later enables a new external service', () => {
    const decision = createConsentDecision(analyticsOnly, { analytics: false, marketing: false })

    expect(consentCovers(decision, { ...analyticsOnly, googleAnalytics: true })).toBe(false)
    expect(consentCovers(decision, { ...analyticsOnly, marketing: true })).toBe(false)
  })

  it('rejects malformed or obsolete cookie payloads', () => {
    expect(consentCovers(null, analyticsOnly)).toBe(false)
    expect(consentCovers({ version: 0, analytics: true }, analyticsOnly)).toBe(false)
    expect(hasAnalyticsConsent('granted')).toBe(false)
  })
})

describe('consent settings launcher', () => {
  it('puts settings inside ClientVersion for both privileged roles', () => {
    expect(consentLauncherFor('admin', true)).toBe('client-version')
    expect(consentLauncherFor('superadmin', false)).toBe('client-version')
  })

  it('uses the bottom-right cookie button only for readers on publication pages', () => {
    expect(consentLauncherFor('user', true)).toBe('cookie-button')
    expect(consentLauncherFor(undefined, true)).toBe('cookie-button')
    expect(consentLauncherFor('user', false)).toBe('none')
    expect(consentLauncherFor(undefined, false)).toBe('none')
  })
})

describe('consent integration contracts', () => {
  it('keeps external measurement manual and loads AdSense only through the tenant-aware component', () => {
    const config = source('nuxt.config.ts')
    const clientSite = source('app/composables/useClientSite.ts')

    expect(config).toContain("initMode: 'manual'")
    expect(config).toContain("cookie_domain: 'none'")
    expect(source('app/components/AdSenseLoader.vue')).toContain('adsbygoogle.js')
    expect(clientSite).not.toContain('useGtag')
    expect(clientSite).not.toContain('gtag.initialize')
    const sentry = source('sentry.client.config.ts')
    expect(sentry).not.toContain('replayIntegration')
    expect(sentry).not.toContain('tracesSampleRate')
  })

  it('mounts one global consent manager and gates analytics and advertising', () => {
    expect(source('app/app.vue')).toContain('<ConsentManager :site="clientSite" :enabled="isPublicationSurface" />')
    expect(source('app/composables/useArticleTracking.ts')).toContain('hasAnalyticsConsent(consentDecision.value)')
    expect(source('app/app.vue')).toContain('platformAdsEnabledForPlan(clientSite?.plan) && marketingGranted')
    expect(source('app/composables/useGam.ts')).not.toContain('EnabledForPlan(client.plan)')
    const footer = source('app/components/Footer.vue')
    expect(footer).not.toContain('v-if="hasOptionalServices"')
    expect(source('app/app.vue')).toContain('<ClientVersion v-if="consentLauncher === \'client-version\'" />')
    expect(source('app/app.vue')).toContain(
      '<ConsentSettingsButton v-else-if="consentLauncher === \'cookie-button\'" />',
    )
    expect(source('app/components/ConsentSettingsButton.vue')).toContain(
      'bottom-action-bar fixed right-6 bottom-4 z-overlay',
    )
    const clientVersion = source('app/components/Client/Version.vue')
    expect(clientVersion).toContain('openConsentSettings')
    expect(clientVersion).toContain('consentSettingsOpen.value = true')
    expect(clientVersion).toContain('show.value = false')
    expect(clientVersion).toContain('data-client-version-bar')
    expect(clientVersion.indexOf('data-consent-settings')).toBeGreaterThan(clientVersion.indexOf('</UPopover>'))
    expect(source('app/assets/styles/main.css')).toContain('body:has(.bottom-action-bar) .back-to-top')
    expect(source('app/components/ConsentManager.vue')).toContain('window.location.reload()')
    expect(source('app/components/ConsentManager.vue')).toContain("const adConsent = marketing ? 'granted' : 'denied'")
    expect(source('i18n/locales/cs/common.json')).not.toContain('Počítá zobrazení článků')
  })

  it('gives the consent banner a role its element is allowed to carry', () => {
    const banner = source('app/components/ConsentManager.vue').split('</template>')[0]!

    // `aside` implies `complementary`, which does not allow `dialog` — the banner then lands in
    // the accessibility tree as a malformed node, and agents navigate by that tree.
    expect(banner).not.toContain('<aside')
    expect(banner).toContain('role="dialog"')
    expect(banner).toContain('aria-labelledby="consent-title"')
  })

  it('renders one responsive tenant GAM placement in the article sidebar', () => {
    const article = source('app/pages/clanky/[slug].vue')

    expect(article.match(/<AdSlot/g)).toHaveLength(1)
    expect(article).toContain('<template #sidebar>')
    expect(article).toContain('adUnitPath="/article/sidebar"')
    expect(article).toContain('{ viewport: [0, 0], sizes: [] }')
    expect(article).toContain('tenantGamEnabled(clientSite?.gamNetworkCode)')
    expect(article).toContain('marketingGranted.value')
    expect(source('app/components/AdSlot.vue')).toContain('if (!defined)')
  })
})
