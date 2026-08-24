import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

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

  it('offers text and plan filters and renders service-specific logos', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const logos = source('app/components/Form/Client/IntegrationLogo.vue')

    expect(catalog).toContain('v-model="filterQuery"')
    expect(catalog).toContain('v-model="planFilter"')
    expect(catalog).toContain('<FormClientIntegrationLogo :name="card.logo" />')
    expect(logos).toContain('fill="#4285F4"')
    expect(logos).toContain("text-[#0a66c2]")
    expect(logos).toContain("text-[#21759b]")
  })

  it('defaults to available integrations and marks inaccessible plan lanes as locked', () => {
    const catalog = source('app/components/Form/Client/IntegrationsCatalog.vue')
    const settings = source('app/pages/settings/index.vue')

    expect(catalog).toContain("shallowRef<'available' | 'all' | 'pro' | 'premium'>('available')")
    expect(catalog).toContain("$t('common.integrationsCatalog.requiresPlan'")
    expect(catalog).toContain("$t('common.integrationsCatalog.includedInPlan')")
    expect(catalog).not.toContain("$t('common.features.includedInPlan')")
    expect(catalog).toContain('if (planFilter.value === \'available\') return hasPlanAccess(section.id)')
    expect(settings).toContain(':currentPlan="client?.plan ?? \'BASIC\'"')
    expect(catalog).not.toContain("label: 'Pro+'")
    expect(catalog).not.toContain("label: 'Premium+'")
  })

  it('centers a wider unsaved changes bar', () => {
    const settings = source('app/pages/settings/index.vue')
    const confirmDialog = source('app/components/ConfirmDialog.vue')
    const styles = source('app/assets/styles/main.css')

    expect(settings).toContain('class="pointer-events-none sticky bottom-4 z-10 flex justify-center"')
    expect(settings).toContain('class="pointer-events-auto w-full max-w-xl shadow-lg"')
    expect(settings).toContain(":description=\"$t('common.preferences.unsavedDescription')\"")
    expect(settings).toContain('class="flex w-full justify-end gap-2"')
    expect(settings).not.toContain('sm:justify-end')
    expect(settings).not.toContain('onBeforeRouteLeave')
    expect(confirmDialog).toMatch(/<UModal\s+portal\s+scrollable/)
    expect(styles).not.toMatch(/\.confirm-dialog-content\s*{[^}]*\b(?:top|left|transform):/s)
  })
})
