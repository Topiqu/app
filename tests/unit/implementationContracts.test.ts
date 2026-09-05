import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('systemic UX implementation contracts', () => {
  it('keeps Zod explicit and TipTap on one exact runtime version', () => {
    const nuxtConfig = source('nuxt.config.ts')
    const packageJson = JSON.parse(source('package.json')) as { dependencies: Record<string, string> }
    const lockfile = source('bun.lock')
    expect(nuxtConfig).not.toMatch(/from:\s*['"]zod['"]/)
    for (const [name, version] of Object.entries(packageJson.dependencies).filter(([name]) =>
      name.startsWith('@tiptap/'),
    )) {
      expect(version, name).toBe('3.30.1')
    }
    expect(lockfile).not.toContain('3.22.3')
  })

  it('assigns dashboard and product shells explicitly', () => {
    for (const path of [
      'app/pages/admin/index.vue',
      'app/pages/admin/editor/[id].vue',
      'app/pages/drafts.vue',
      'app/pages/settings/index.vue',
      'app/pages/master/index.vue',
    ]) {
      expect(source(path), path).toContain("shell: 'dashboard'")
    }
    for (const path of [
      'app/pages/autorizace/index.vue',
      'app/pages/oauth-start.vue',
      'app/pages/uzivatel/index.vue',
    ]) {
      expect(source(path), path).toContain("shell: 'product'")
    }
  })

  it('keeps overlay widths and mobile fullscreen behavior intentional', () => {
    expect(source('app/components/ConfirmDialog.vue')).toContain("content: 'confirm-dialog-content max-w-md'")
    expect(source('app/components/Article/Tag.vue')).toContain("content: 'max-w-xl'")
    expect(source('app/components/Tags/Create.vue')).toContain("content: 'max-w-3xl'")
    expect(source('app/components/Stats/Dialog.vue')).toContain('max-w-none flex-col max-sm:size-full')
    expect(source('app/app.config.ts')).toContain('max-sm:size-full')
  })

  it('keeps status labels readable in a portaled 12rem menu', () => {
    const statusCell = source('app/components/Article/StatusCell.vue')
    expect(statusCell).toContain("content: 'min-w-48'")
    expect(statusCell).toContain("$t('articles.status.draft')")
    expect(statusCell).toContain("$t('articles.status.published')")
    expect(statusCell).toContain("$t('articles.status.archived')")
  })

  it('uses one article header and one shared scroll state', () => {
    const scrollContext = source('app/composables/useArticleScrollContext.ts')
    expect(source('app/pages/clanky/[slug].vue')).not.toContain('ArticleHeaderSticky')
    expect(source('app/pages/clanky/[slug].vue')).not.toContain("addEventListener('scroll'")
    expect(source('app/components/Header.vue')).toContain('useArticleScrollState()')
    expect(source('app/components/Article/TOC.vue')).toContain('useArticleScrollState()')
    expect(scrollContext).toContain("closest<HTMLElement>('.topiqu-dashboard-scroll')")
    expect(scrollContext).toContain('scrollContainer.value ?? window')
    expect(scrollContext).toContain('scroller?.scrollTop ?? window.scrollY')
  })

  it('keeps compact dashboard controls and publication spacing aligned to the real shell', () => {
    const upgrade = source('app/components/Admin/UpgradeBanner.vue')
    const version = source('app/components/Client/Version.vue')
    const table = source('app/components/Article/Table.vue')
    const homepage = source('app/pages/index.vue')
    const card = source('app/components/Article/Card.vue')
    const comments = source('app/components/Comment/Section.vue')

    expect(upgrade).toContain('class="absolute right-3 top-3"')
    expect(version).toContain('max-w-[8.5rem]')
    expect(table).toContain('class="w-full min-w-0 sm:flex-1"')
    expect(homepage).toContain('class="sticky z-20 w-full')
    expect(homepage).toContain("hasDashboardChrome ? 'top-0' : 'top-[var(--topiqu-header-height)]'")
    expect(card).toContain('space-y-3')
    expect(comments).toContain("leading: 'items-center self-stretch'")
    expect(source('app/components/Sidebar.vue')).toContain("collapsed ? 'justify-center' : 'justify-between'")
  })

  it('uses one canonical article card contract for every presentation variant', () => {
    const card = source('app/components/Article/Card.vue')
    const types = source('shared/types/article.ts')
    expect(types).toContain('export type ArticleCardData')
    expect(types).toContain("export type ArticleCardVariant = 'standard' | 'featured' | 'compact'")
    expect(types).toContain("export type ArticleCardLayout = 'column' | 'responsive-row'")
    expect(card).toContain('variant?: ArticleCardVariant')
    expect(card).toContain('layout?: ArticleCardLayout')
    expect(card).toContain("layout = 'column'")
    expect(card).toContain('@min-[36rem]')
    expect(card).toContain('<UBadge')
    expect(card).toContain('<UCard')
    expect(card).toContain("variant === 'compact' ? 'gap-3 p-4' : 'gap-5 p-5 sm:p-6'")
    expect(card).toContain('<slot name="actions"')
    for (const path of [
      'app/pages/index.vue',
      'app/pages/stitky/[slug].vue',
      'app/pages/autor/[name].vue',
      'app/components/Article/Related.vue',
      'app/components/User/ActivityArticle.vue',
    ]) {
      expect(source(path), path).toContain('ArticleCard')
    }
    expect(source('app/components/Article/Related.vue')).toContain('layout="column"')
    expect(source('app/pages/index.vue')).toContain('layout="responsive-row"')
  })

  it('keeps the article fallback, comments and sources editorial rather than card-heavy', () => {
    const parsed = source('app/components/Article/Parsed.vue')
    const images = source('shared/utils/articleImages.ts')
    const comments = source('app/components/Comment/Section.vue')
    const articlePage = source('app/pages/clanky/[slug].vue')

    expect(images).toContain("'data-original-src'")
    expect(parsed).toContain("failed.dataset.originalRetry !== 'true'")
    expect(parsed).toContain("failed.removeAttribute('srcset')")
    expect(parsed).toContain('failed.replaceWith(fallback)')
    expect(parsed).toContain('media.complete && media.naturalWidth === 0')
    expect(articlePage).toContain('class="article-content mx-auto w-full"')
    expect(comments).not.toContain('<UCard')
    expect(comments).toContain('color="primary" variant="solid"')
    expect(comments).toContain('class="mb-10"')
  })

  it('renders a shared responsive editor settings panel and the complete translation workflow', () => {
    const editor = source('app/pages/admin/editor/[id].vue')
    const panel = source('app/components/Article/Editor/SettingsPanel.vue')
    const tabs = source('app/components/Article/Editor/LanguageTabs.vue')
    const table = source('app/components/Article/Table.vue')

    expect(editor).toContain('<ArticleEditorLanguageTabs')
    expect(editor).toContain('<ArticleEditorSettingsPanel')
    expect(editor).toContain("useLocalStorage('topiqu-editor-settings-expanded', true)")
    expect(editor).toContain("tr.save('PUBLISHED')")
    expect(editor).toContain('tr.translateNow()')
    expect(editor).toContain('discardTranslationOpen = true')
    expect(panel).toContain('data-article-settings-panel')
    expect(panel).toContain('<ArticleSources')
    expect(tabs).not.toContain('indigo')
    expect(table).toContain(':articleRef="row.original.slug"')
    expect(table).toContain('const mobileActionItems')
    expect(table).toContain('onSelect: () => translateArticle(article)')
  })

  it('keeps modal scrolling, sticky filters and role shell contracts explicit', () => {
    const stats = source('app/components/Stats/Dialog.vue')
    const table = source('app/components/Article/Table.vue')
    const layout = source('app/layouts/default.vue')
    const pageMeta = source('types/page-meta.d.ts')

    expect(stats).toContain('<template #header')
    expect(stats).toContain('<template #body>')
    expect(stats).toContain('<template #footer')
    expect(source('app/app.config.ts')).toContain("body: 'min-h-0 flex-1 overflow-y-auto'")
    expect(table).toContain('data-article-table-toolbar')
    expect(table).toContain('sm:max-h-[min(22rem,calc(100dvh-8rem))]')
    expect(layout).toContain('route.meta.dashboardSidebar')
    expect(layout).toContain('storage="cookie"')
    expect(layout).toContain('isSidebarOpen.value = false')
    expect(pageMeta).toContain('dashboardSidebar?: false')
    for (const path of [
      'app/pages/autorizace/index.vue',
      'app/pages/oauth-start.vue',
      'app/pages/invitation/[token].vue',
    ]) {
      expect(source(path), path).toContain('dashboardSidebar: false')
    }
  })

  it('uses source slugs canonically while retaining an admin UUID fallback', () => {
    const detail = source('server/api/articles/[id]/index.get.ts')
    const actions = source('app/components/Article/ActionsBar.vue')
    const review = source('app/components/Admin/TranslationReviewBanner.vue')

    expect(detail).toContain('OR: [{ slug }, { id: slug }]')
    expect(detail).toContain('sourceSlug: baseSlug')
    expect(actions).toContain('article.sourceSlug || article.slug')
    expect(actions).toContain('@update="onStatusUpdate"')
    expect(actions).not.toContain('<UBadge')
    expect(review).toContain('query: { lang: row.language }')
  })

  it('uses recommended homepage data once and returns a compact client user count', () => {
    const homepage = source('app/pages/index.vue')
    const clientRoute = source('server/api/clients/index.get.ts')
    const clientTable = source('app/components/Client/Table.vue')
    expect(homepage).toContain('feat.value?.recommended')
    expect(homepage).toContain('reservedIds')
    expect(clientRoute).toContain('_count: { select: { users: true } }')
    expect(clientRoute).toContain('userCount: _count.users')
    expect(clientRoute).not.toContain('username: true')
    expect(clientTable).toContain("accessorKey: 'userCount'")
    expect(clientTable).toContain("id: 'status'")
  })

  it('implements the fourth stabilization interaction contracts', () => {
    const homepage = source('app/pages/index.vue')
    const table = source('app/components/Article/Table.vue')
    const tags = source('app/components/Tags/Create.vue')
    const stats = source('app/components/Stats/Dialog.vue')
    const chart = source('app/components/Charts.vue')
    const gif = source('app/components/Gif/Selector.vue')
    const sidebar = source('app/components/Sidebar.vue')

    expect(homepage).toContain('data-editorial-hero')
    expect(homepage).not.toContain('<ArticleCard v-if="heroArticle?.slug"')
    expect(table).toContain("base: 'w-full min-w-[48rem] table-fixed'")
    expect(table).not.toContain("label: $t('common.actions.view')")
    expect(table.match(/:aria-label="\$t\('articles\.openArticle'\)"/g)).toHaveLength(2)
    expect(table).toContain("header: $t('articles.columns.actions')")
    expect(source('app/components/Exports.vue')).toContain('<UDropdownMenu')
    expect(tags).toContain('const editDraft')
    expect(tags).not.toContain('useDebounceFn(async (tag')
    expect(stats).toContain('<StatsRow')
    expect(stats).toContain('kind="trend"')
    expect(stats).toContain('kind="breakdown"')
    expect(chart).toContain("kind: 'trend' | 'breakdown'")
    expect(gif).toContain('watch(pickerOpen')
    expect(gif).toContain('requestVersion')
    expect(gif).toContain('collisionPadding: 16')
    expect(gif).not.toContain('onMounted')
    expect(sidebar).toContain(':collapsed="collapsed"')
  })

  it('keeps the regression fixes for publication, comments, admin table, profile navigation and rate limiting', () => {
    const styles = source('app/assets/styles/main.css')
    const comments = source('app/components/Comment/Section.vue')
    const status = source('app/components/Article/StatusCell.vue')
    const profile = source('app/pages/uzivatel/index.vue')
    const config = source('nuxt.config.ts')

    expect(styles).toContain('background-color: var(--topiqu-cta-bg, var(--ui-primary)) !important')
    expect(styles).not.toContain('.comment-composer-textarea:focus-within')
    expect(styles).not.toMatch(/^:focus-visible/m)
    expect(comments).not.toContain('comment-composer-textarea')
    expect(comments).toContain('<UTextarea')
    expect(profile).toContain('<TabNav')
    expect(status).toContain("base: 'w-full min-w-0'")
    expect(profile).toContain('tabForSection')
    expect(profile).toContain('focusSection')
    expect(config).toContain('tokensPerInterval: IS_BROWSER_TEST ? 10_000 : 300')
  })
})
