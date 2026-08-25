import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const messages = (locale: 'cs' | 'en') => JSON.parse(source(`i18n/locales/${locale}/common.json`))

describe('dashboard UI polish contracts', () => {
  it.each(['cs', 'en'] as const)('translates every tenant scope in %s', (locale) => {
    const scopes = messages(locale).common.members.scopes
    expect(Object.keys(scopes)).toEqual([
      'ARTICLE_WRITE',
      'ARTICLE_WRITE_OTHERS',
      'ARTICLE_PUBLISH',
      'MEMBER_CONTROL',
      'TENANT_SETTINGS',
      'INTEGRATION_CONTROL',
      'BILLING_CHANGE',
      'API_KEY_CONTROL',
      'AI_USE',
      'ANALYTICS_READ',
      'CONTENT_MODERATE',
    ])
    expect(Object.values(scopes).every((label) => typeof label === 'string' && label.length > 3)).toBe(true)
  })

  it('opens the emoji manager with the current Nuxt UI modal', () => {
    const emoji = source('app/components/Emoji/Create.vue')
    expect(emoji).toContain('<UModal')
    expect(emoji).toContain('v-model:open="open"')
    expect(emoji).not.toContain('<Modal ')
  })

  it('keeps plan and token details in the bottom-right app layer', () => {
    expect(source('app/app.vue')).toContain('<ClientVersion v-if="consentLauncher === \'client-version\'" />')
    expect(source('app/app.vue')).toContain(
      '<ConsentSettingsButton v-else-if="consentLauncher === \'cookie-button\'" />',
    )
    expect(source('app/components/Header.vue')).not.toContain('<ClientVersion')
    expect(source('app/components/Sidebar.vue')).not.toContain('<ClientVersion')
    const clientVersion = source('app/components/Client/Version.vue')
    expect(clientVersion).toContain('bottom-action-bar fixed right-3 bottom-3 z-overlay')
    expect(clientVersion).toContain('max-h-[calc(100dvh-5rem)]')
    expect(clientVersion).toContain('overflow-x-hidden overflow-y-auto overscroll-contain')
    expect(clientVersion).toContain('grid-cols-1 gap-2 min-[22rem]:grid-cols-2')
    expect(clientVersion).toContain('data-consent-settings')
    expect(source('app/components/ConsentSettingsButton.vue')).toContain(
      'bottom-action-bar fixed right-3 bottom-3 z-overlay',
    )
    expect(source('app/assets/styles/main.css')).toContain('body:has(.bottom-action-bar) .back-to-top')
  })

  it('keeps SSR navigation out of the PWA app-shell cache', () => {
    const config = source('nuxt.config.ts')
    expect(config).toContain('sri: false')
    expect(config).toContain("'/sw.js': { headers: { 'cache-control': 'no-cache, no-store, must-revalidate' } }")
    expect(config).toContain('navigateFallback: null')
  })

  it('renders a priced, benefit-led billing upsell with a compact action', () => {
    const billing = source('app/components/Form/Client/Billing.vue')
    expect(billing).toContain("'/api/stripe/plans'")
    expect(billing).toContain('upsellFeatures')
    expect(billing).toContain('formattedPlanPrice')
    expect(billing).not.toContain('<UButton v-if="upgradeTarget" class="flex-1"')
    expect(source('server/api/stripe/plans.get.ts')).not.toContain('id: price.id')
  })

  it('uses aligned, state-derived DevConsole status dots', () => {
    const devConsole = source('app/components/Dev/Console.vue')
    expect(devConsole).toContain('grid-cols-[5rem_minmax(0,1fr)] items-center')
    expect(devConsole).toContain(':class="dbStatusClass"')
    expect(devConsole).not.toContain('<UChip')
  })

  it('keeps reaction state across homepage card remounts', () => {
    const card = source('app/components/Article/Card.vue')
    expect(card).toContain("'article-card-reactions'")
    expect(card).toContain('[props.article.id]: result')
  })

  it('renders explicit account-health icons and visible notification switches', () => {
    const health = source('app/components/User/AccountHealth.vue')
    expect(health).toContain('<UserHealthHeartIcon')
    const heart = source('app/components/User/HealthHeartIcon.vue')
    expect(heart).toContain("variant === 'broken'")
    expect(heart).toContain("variant === 'minus'")
    expect(source('app/components/User/Notifications.vue')).toContain('<USwitch')
  })

  it('keeps GIF categories full-sized and switches the Giphy mark with the color mode', () => {
    const gif = source('app/components/Gif/Selector.vue')
    expect(gif).toContain('relative aspect-[4/3] w-full')
    expect(gif).toContain('Poweredby_100px-Black_VertLogo.png')
    expect(gif).toContain('dark:hidden')
    expect(gif).toContain('Poweredby_100px-White_VertLogo.png')
    expect(gif).toContain('dark:block')
  })

  it('uses a short-lived dev login token for impersonation', () => {
    expect(source('app/components/Dev/Console.vue')).toContain("'/api/_dev/impersonate'")
    const endpoint = source('server/api/_dev/impersonate.post.ts')
    expect(endpoint).toContain(`if (!${'import.meta'}.dev)`)
    expect(endpoint).toContain('onboardingLoginTokenExpiresAt')
  })

  it('resolves ClientVersion from the active tenant status', () => {
    const version = source('app/components/Client/Version.vue')
    expect(version).toContain('const { data: status } = await useClientSiteStatus()')
    expect(version).not.toContain('/by-userid')
    expect(source('server/api/clients/status.get.ts')).toContain('name: true')
  })

  it('uses current controls for poll editing and exposes the avatar file action', () => {
    const poll = source('extensions/Poll.vue')
    expect(poll).toContain('<UInput')
    expect(poll).toContain('<UButton')
    expect(poll).not.toContain('<FormInput')
    expect(poll).not.toContain('<Button')
    expect(source('app/components/User/PictureUploader.vue')).toContain("$t('common.avatar.chooseImage')")
  })

  it('shows one responsive autosave status and branded share clues', () => {
    const editor = source('app/pages/admin/editor/[id].vue')
    expect(editor).toContain('sm:flex md:hidden')
    expect(editor).toContain('saveConfirmed')
    expect(editor).toContain('i-mdi-check-circle')
    const stats = source('app/components/Stats/Dialog.vue')
    expect(stats).toContain('PLATFORM_COLORS')
    expect(source('app/components/Charts.vue')).toContain('#category-cell')
  })

  it('keeps the mobile editor inside the viewport and gives article settings useful width', () => {
    const page = source('app/pages/admin/editor/[id].vue')
    const editor = source('app/components/Tiptap/Editor.vue')
    const toolbar = source('app/components/Tiptap/Toolbar.vue')
    const styles = source('app/assets/styles/main.css')

    expect(page).toContain('lg:grid-cols-[minmax(0,1fr)_24rem]')
    expect(page).toContain('class="mt-4 min-w-0 max-w-full"')
    expect(editor).toContain('flex min-w-0 max-w-full flex-col')
    expect(toolbar).toContain('overflow-x-auto overscroll-x-contain')
    expect(styles).toContain('.editor-canvas .ProseMirror pre')
    expect(styles).toContain('overflow-wrap: anywhere')
  })
})
