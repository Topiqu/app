import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

// Read from disk, not `import`: the i18n plugin compiles imported locale JSON into message
// functions, so every string assertion against it would pass vacuously.
const catalogMessages = (locale: string): Record<string, string> =>
  JSON.parse(source(`i18n/locales/${locale}/common.json`)).common.integrationsCatalog

describe('settings integrations catalog', () => {
  it('keeps the Search Console connection reachable from settings', () => {
    const settings = source('app/pages/settings/index.vue')
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')

    expect(settings).toContain('<FormClientIntegrationsCatalog')
    expect(catalog).toContain('<FormClientSearchConsole embedded />')
    expect(catalog).toContain('v-model:open="gscOpen"')
    expect(catalog).toContain('@click="openDialog(card.id)"')
    expect(catalog).not.toContain('<Modal ')
  })

  it('presents WordPress with its description and a TBD status without setup instructions', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')

    expect(catalog).toContain("description: $t('common.integrationsCatalog.wordpressDescription')")
    expect(catalog).toContain('>TBD</UBadge>')
    expect(catalog).not.toContain("$t('common.integrationsCatalog.wordpressStepOne')")
    expect(catalog).not.toContain("$t('common.integrationsCatalog.wordpressBenefitOne')")
  })

  it('groups integrations by their minimum plan and keeps API actions beside the input', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const settings = source('app/pages/settings/index.vue')

    expect(catalog).toContain("id: 'pro'")
    expect(catalog).toContain("id: 'premium'")
    expect(catalog).toContain('data-api-key-row')
    expect(catalog).toContain('data-api-key-actions')
    expect(catalog).not.toContain('<template #trailing>')
    expect(catalog).not.toContain('class="absolute right-2')
    expect(settings).toContain("$t('common.preferences.api.regenerateWarning')")
    expect(settings).toContain("variant: 'danger'")
  })

  it('gives Google Ad Manager its own card instead of hiding it in the Analytics dialog', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const analyticsDialog = catalog.slice(
      catalog.indexOf('v-model:open="analyticsOpen"'),
      catalog.indexOf('v-model:open="gamOpen"'),
    )

    expect(catalog).toContain("id: 'gam'")
    expect(catalog).toContain("title: 'Google Ad Manager'")
    expect(catalog).toContain("logo: 'admanager'")
    expect(catalog).toContain('v-model:open="gamOpen"')
    expect(analyticsDialog).not.toContain('gamNetworkCode')
    expect(source('app/components/Form/Client/IntegrationLogo.vue')).toContain("return 'mdi:google-ads'")
  })

  it('keeps the Ad Manager card findable by the title+description filter under either name', () => {
    for (const catalog of [catalogMessages('cs'), catalogMessages('en')]) {
      expect(catalog.gamDescription).toContain('Google Ad Manager')
      expect(catalog.gamDescription).toContain('GAM')
      expect(catalog.gamBenefitOne).toBeTruthy()
      expect(catalog.gamBenefitTwo).toBeTruthy()
      expect(catalog.gamStepOne).toContain('/article/sidebar')
      expect(catalog.gamStepTwo).toBeTruthy()
      expect(catalog.gamStepThree).toBeTruthy()
      expect(catalog.gamConsentNote).toBeTruthy()
    }
  })

  it('offers text and plan filters and renders service-specific logos', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const logos = source('app/components/Form/Client/IntegrationLogo.vue')

    expect(catalog).toContain('v-model="filterQuery"')
    expect(catalog).toContain('v-model="planFilter"')
    expect(catalog).toContain('<FormClientIntegrationLogo :name="card.logo" />')
    expect(logos).toContain('fill="#4285F4"')
    expect(logos).toContain('text-[#0a66c2]')
    expect(logos).toContain('text-[#21759b]')
  })

  it('defaults to available integrations and marks inaccessible plan lanes as locked', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const settings = source('app/pages/settings/index.vue')

    expect(catalog).toContain("shallowRef<'available' | 'all' | 'pro' | 'premium'>('available')")
    expect(catalog).toContain("$t('common.integrationsCatalog.requiresPlan'")
    expect(catalog).toContain("$t('common.integrationsCatalog.includedInPlan')")
    expect(catalog).not.toContain("$t('common.features.includedInPlan')")
    expect(catalog).toContain("if (planFilter.value === 'available') return hasPlanAccess(section.id)")
    expect(settings).toContain(':currentPlan="client?.plan ?? \'BASIC\'"')
    expect(catalog).not.toContain("label: 'Pro+'")
    expect(catalog).not.toContain("label: 'Premium+'")
  })

  it('floats the unsaved changes bar from one shared component', () => {
    const settings = source('app/pages/settings/index.vue')
    const profile = source('app/pages/uzivatel/index.vue')
    const bar = source('app/components/UnsavedBar.vue')
    const confirmDialog = source('app/components/ConfirmDialog.vue')
    const styles = source('app/assets/styles/main.css')

    expect(settings).toContain('<UnsavedBar :dirty="isDirty" :loading="isSaving"')
    expect(profile).toContain('<UnsavedBar :dirty="isDirty" :loading="isLoading"')
    expect(settings).not.toContain('sticky bottom-4')
    expect(settings).not.toContain('onBeforeRouteLeave')
    expect(bar).toContain('<Teleport to="body">')
    expect(bar).toContain('fixed inset-x-0 bottom-4 z-header')
    expect(bar).toContain("$t('common.preferences.unsavedDescription')")
    expect(bar).toContain('motion-reduce:hidden')
    expect(confirmDialog).toMatch(/<UModal\s+portal\s+scrollable/)
    expect(styles).not.toMatch(/\.confirm-dialog-content\s*{[^}]*\b(?:top|left|transform):/s)
  })
})
