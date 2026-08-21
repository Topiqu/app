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
    expect(source('app/components/Stats/Dialog.vue')).toContain("content: 'max-w-5xl'")
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
    expect(source('app/pages/clanky/[slug].vue')).not.toContain('ArticleHeaderSticky')
    expect(source('app/pages/clanky/[slug].vue')).not.toContain("addEventListener('scroll'")
    expect(source('app/components/Header.vue')).toContain('useArticleScrollState()')
    expect(source('app/components/Article/TOC.vue')).toContain('useArticleScrollState()')
  })

  it('uses one canonical article card contract for every presentation variant', () => {
    const card = source('app/components/Article/Card.vue')
    const types = source('shared/types/article.ts')
    expect(types).toContain('export type ArticleCardData')
    expect(types).toContain("export type ArticleCardVariant = 'standard' | 'featured' | 'compact'")
    expect(types).toContain("export type ArticleCardLayout = 'column' | 'responsive-row'")
    expect(card).toContain('variant?: ArticleCardVariant')
    expect(card).toContain('layout?: ArticleCardLayout')
    expect(card).toContain("layout: 'column'")
    expect(card).toContain('@min-[36rem]')
    expect(card).toContain('<UBadge')
    expect(card).toContain('<slot name="actions"')
    for (const path of [
      'app/pages/index.vue',
      'app/pages/stitky/[slug].vue',
      'app/pages/autor/[name].vue',
      'app/components/Article/Related.vue',
      'app/components/User/Activity.vue',
    ]) {
      expect(source(path), path).toContain('ArticleCard')
    }
    expect(source('app/components/Article/Related.vue')).toContain('layout="column"')
    expect(source('app/pages/index.vue')).toContain('layout="responsive-row"')
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
    expect(source('app/components/Exports.vue')).toContain('<UDropdownMenu')
    expect(tags).toContain('const editDraft')
    expect(tags).not.toContain('useDebounceFn(async (tag')
    expect(stats).toContain('rankedItems')
    expect(stats).toContain('kind="timeseries"')
    expect(stats).toContain('kind="distribution"')
    expect(chart).toContain("kind: 'timeseries' | 'distribution'")
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
    expect(profile).toContain("href: '#personal-section'")
    expect(status).toContain("base: 'w-full min-w-0'")
    expect(profile.indexOf("href: '#account-health-section'")).toBeLessThan(
      profile.indexOf("href: '#security-section'"),
    )
    expect(profile).toContain('new IntersectionObserver')
    expect(profile).toContain(':aria-current=')
    expect(config).toContain('tokensPerInterval: IS_BROWSER_TEST ? 10_000 : 300')
  })
})
