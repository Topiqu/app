import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'

const appRoot = join(process.cwd(), 'app')

const vueFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })

const sources = vueFiles(appRoot).map((path) => ({
  path: relative(process.cwd(), path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}))
const nuxtUiComponents = new Set(
  vueFiles(join(process.cwd(), 'node_modules/@nuxt/ui/dist/runtime/components')).map((path) => {
    const name = basename(path)
    return `U${name.slice(0, -4)}`
  }),
)
const sourceOf = (path: string) => sources.find((file) => file.path === path)?.source ?? ''

const openingTags = (source: string) => {
  const tags: { name: string; tag: string; start: number; end: number }[] = []
  const matcher = /<(?<name>U[A-Z][A-Za-z0-9]*)\b/g

  for (const match of source.matchAll(matcher)) {
    const start = match.index
    let quote = ''
    for (let index = start; index < source.length; index++) {
      const character = source[index] ?? ''
      if ((character === '"' || character === "'") && source[index - 1] !== '\\') {
        quote = quote === character ? '' : quote || character
      } else if (character === '>' && !quote) {
        tags.push({ name: match.groups?.name ?? '', tag: source.slice(start, index + 1), start, end: index + 1 })
        break
      }
    }
  }

  return tags
}

const nuxtUiTags = ({ path, source }: (typeof sources)[number]) =>
  openingTags(source)
    .filter(({ name }) => name !== 'UIcon')
    .map(({ tag }) => ({ path, tag }))

const nuxtUiIconTags = ({ path, source }: (typeof sources)[number]) =>
  openingTags(source)
    .filter(({ name }) => name === 'UIcon')
    .map(({ tag }) => ({ path, tag }))

const visualUtility =
  /(?:^|\s)(?:bg-|text-(?:xs|sm|base|lg|xl|[2-9]xl|gray|neutral|slate|red|green|blue|indigo|purple|white|black)|border(?:-|\s)|ring-|rounded|shadow|p[trblxy]?-[0-9]|gap-|space-[xy]-|items-|justify-|content-|place-|flex-wrap|hover:|focus:|dark:|transition|animate-|font-|tracking-|uppercase)/

const failuresFor = (pattern: RegExp, allowlist: ReadonlySet<string> = new Set()) =>
  sources.filter(({ path, source }) => !allowlist.has(path) && pattern.test(source)).map(({ path }) => path)

describe('Nuxt UI template contract', () => {
  it('only references components shipped by the installed Nuxt UI version', () => {
    const used = new Set(sources.flatMap(({ source }) => openingTags(source).map(({ name }) => name)))
    expect([...used].filter((name) => !nuxtUiComponents.has(name)).sort()).toEqual([])
  })

  it('does not reintroduce native interactive primitives', () => {
    const allowlist = new Set([
      'app/components/Client/Version.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Form/Client/Billing.vue',
      'app/components/Gif/Selector.vue',
    ])
    expect(failuresFor(/<(?:button|input|select|textarea|table|dialog|progress)(?:\s|>)/, allowlist)).toEqual([])
  })

  it('keeps actual form controls inside UFormField', () => {
    const toolbarAllowlist = new Set([
      'app/components/Tiptap/Toolbar.vue',
      'app/components/Emoji/Create.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Form/Client/FeatureToggle.vue',
      'app/components/Form/Client/LogoUploader.vue',
      'app/components/Settings/Members.vue',
      'app/components/User/PictureUploader.vue',
      'app/components/User/QR.vue',
    ])
    const controls = new Set([
      'UCheckbox',
      'UCheckboxGroup',
      'UColorPicker',
      'UFileUpload',
      'UInput',
      'UInputNumber',
      'UPinInput',
      'URadioGroup',
      'USelect',
      'USelectMenu',
      'USwitch',
      'UTextarea',
    ])
    const failures = sources
      .filter(({ path }) => !toolbarAllowlist.has(path))
      .flatMap(({ path, source }) =>
        openingTags(source)
          .filter(({ name }) => controls.has(name))
          .filter(({ tag, start }) => {
            const fieldTokens = [...source.slice(0, start).matchAll(/<\/?UFormField\b[^>]*>/g)]
            const lastFieldToken = fieldTokens.at(-1)?.[0] ?? ''
            const inField = lastFieldToken.startsWith('<UFormField') && !lastFieldToken.endsWith('/>')
            const explicitlyLabelled = /\b(?::?aria-label|:?id)=/.test(tag)
            return !inField && !explicitlyLabelled
          })
          .map(({ tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`),
      )

    expect(failures).toEqual([])
  })

  it('uses NuxtImg outside OG and external auth brand assets', () => {
    const allowlist = new Set([
      'app/components/AppMedia.vue',
      'app/components/Auth/Form.vue',
      'app/components/Gif/Selector.vue',
      'app/components/OgImage/AppDefault.takumi.vue',
      'app/components/OgImage/ClientSite.takumi.vue',
      'app/components/OgImage/TopiquArticle.takumi.vue',
    ])
    expect(failuresFor(/<img(?:\s|>)/i, allowlist)).toEqual([])
  })

  it('uses the configured MDI icon collection', () => {
    expect(failuresFor(/(?:name|icon)=["'][^"']*lucide:/i)).toEqual([])
  })

  it('sizes icons through the Nuxt UI prop and limits direct brand colors', () => {
    const sizeAllowlist = new Set([
      'app/components/Client/Version.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Form/Client/Billing.vue',
      'app/pages/admin/editor/[id].vue',
    ])
    const hardColorAllowlist = new Set([
      'app/components/Form/Client/Branding.vue',
      'app/components/Form/Client/LinkedIn.vue',
      'app/components/Landing/Hero.vue',
      'app/components/Landing/index.vue',
      'app/pages/settings/index.vue',
    ])
    const icons = sources.flatMap(nuxtUiIconTags)

    expect(
      icons
        .filter(({ path }) => !sizeAllowlist.has(path))
        .filter(({ tag }) => !/\bsize=/.test(tag) || /(?:class|:class)=["'][^"']*\b(?:w|h|size)-/.test(tag))
        .map(({ path, tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`),
    ).toEqual([])
    expect(
      icons
        .filter(({ path }) => !hardColorAllowlist.has(path))
        .filter(({ tag }) =>
          /class=["'][^"']*text-(?:gray|blue|green|red|purple|indigo|teal|amber|orange|violet|emerald|black|white)/.test(
            tag,
          ),
        )
        .map(({ path, tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`),
    ).toEqual([])
  })

  it('uses icon props instead of nested icons in buttons and badges', () => {
    const failures = sources.flatMap(({ path, source }) =>
      openingTags(source)
        .filter(({ name, tag }) => (name === 'UButton' || name === 'UBadge') && !tag.endsWith('/>'))
        .filter(({ name, end }) => {
          const closing = source.indexOf(`</${name}>`, end)
          return closing !== -1 && /<UIcon\b/.test(source.slice(end, closing))
        })
        .map(({ tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`),
    )

    expect(failures).toEqual([])
  })

  it('keeps CSS loading indicators at media and editor boundaries', () => {
    const allowlist = new Set([
      'app/components/Article/Editor/AiComposer.vue',
      'app/components/Article/Editor/TagsField.vue',
      'app/components/Form/Client/LogoUploader.vue',
      'app/components/Client/Version.vue',
      'app/components/Form/Client/Billing.vue',
      'app/components/User/AccountHealth.vue',
      'app/components/User/PictureUploader.vue',
      'app/pages/admin/editor/[id].vue',
      'app/pages/invitation/[token].vue',
    ])
    expect(failuresFor(/\banimate-(?:spin|rotate)\b|svg-spinners:|role=["']progressbar["']/i, allowlist)).toEqual([])
  })

  it('keeps visual utility classes off Nuxt UI primitives', () => {
    const allowlist = new Set([
      'app/components/File/TiptapImage.vue',
      'app/components/Article/Editor/AiComposer.vue',
      'app/components/Article/Editor/Chip.vue',
      'app/components/Article/Editor/LanguageTabs.vue',
      'app/components/Article/Editor/TagsField.vue',
      'app/components/Emoji/Create.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Form/Client/Billing.vue',
      'app/components/Form/Client/IntegrationsCatalog.vue',
      'app/components/Form/Client/LinkedIn.vue',
      'app/components/Form/Client/LogoUploader.vue',
      'app/components/Notification/Bar.vue',
      'app/components/Settings/Members.vue',
      'app/components/Stats/Dialog.vue',
      'app/components/User/AccountHealth.vue',
      'app/components/User/Activity.vue',
      'app/components/User/ActivityArticle.vue',
      'app/components/User/ActivityComment.vue',
      'app/components/User/Sessions.vue',
      'app/pages/settings/index.vue',
    ])
    const failures = sources
      .filter(({ path }) => !allowlist.has(path))
      .flatMap(nuxtUiTags)
      .filter(({ tag }) =>
        [...tag.matchAll(/\b(?::?class)="([^"]+)"/gs)].some((match) => visualUtility.test(match[1] ?? '')),
      )
      .map(({ path, tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`)

    expect(failures).toEqual([])
  })

  it('limits local slot overrides to accessibility and layout', () => {
    const failures = sources
      .flatMap(nuxtUiTags)
      .filter(({ tag }) =>
        /\b:ui="[^"]*(?:bg-|text-(?!clip\b)|border-|ring-|rounded|shadow|p[trblxy]?-[0-9]|gap-|hover:|focus:|dark:|transition|animate-|font-)/s.test(
          tag,
        ),
      )
      .map(({ path, tag }) => `${path}: ${tag.replace(/\s+/g, ' ')}`)

    expect(failures).toEqual([])
  })

  it('uses current Nuxt UI icon props and avoids visual class maps', () => {
    expect(failuresFor(/\biconPosition=/)).toEqual([])
    expect(failuresFor(/(?:themeRings|focusRingClass|badgeClass|cardClass|statusClass|ringClass)\b/)).toEqual([])
  })

  it('limits manual pulse decoration to the marketing hero', () => {
    const allowlist = new Set([
      'app/components/Landing/Hero.vue',
      'app/components/Form/Client/Billing.vue',
      'app/components/Form/Client/SearchConsole.vue',
      'app/components/Stats/Dialog.vue',
      'app/components/User/Activity.vue',
      'app/pages/uzivatel/index.vue',
    ])
    expect(failuresFor(/\banimate-pulse\b/i, allowlist)).toEqual([])
  })

  it('does not style NuxtLink as a button', () => {
    expect(
      failuresFor(/<NuxtLink\b[^>]*(?:class|:class)=["'][^"']*(?:\bbg-|\bshadow|\brounded|\bpx-|\bpy-)/is),
    ).toEqual([])
  })

  it('centralizes semantic surface tokens and Nuxt UI themes', () => {
    const config = readFileSync(join(process.cwd(), 'app/app.config.ts'), 'utf8')
    const styles = readFileSync(join(process.cwd(), 'app/assets/styles/main.css'), 'utf8')
    expect(config).toContain('ui:')
    expect(config).toContain('colors:')
    expect(styles).toContain('--topiqu-surface-radius')
    expect(styles).toContain('--topiqu-cta-bg')
  })

  it('keeps canonical publication cards and related cards on one component', () => {
    expect(sourceOf('app/components/Article/Related.vue')).toContain('<ArticleCard')
    expect(sourceOf('app/pages/index.vue')).toContain('<ArticleCard')
  })

  it('does not hide legacy visual utility maps behind computed class names', () => {
    expect(failuresFor(/(?:themeRings|focusRingClass|badgeClass|cardClass|statusClass|ringClass)\b/)).toEqual([])
  })

  it('limits component CSS and manual transitions to content and third-party boundaries', () => {
    const styleAllowlist = new Set([
      'app/components/Article/TOC.vue',
      'app/components/Landing/Hero.vue',
      'app/components/Article/SkeletonCard.vue',
      'app/components/Article/Editor/Popover.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Tiptap/Editor.vue',
      'app/pages/clanky/[slug].vue',
      'app/pages/index.vue',
      'app/pages/uzivatel/index.vue',
    ])
    const transitionAllowlist = new Set([
      'app/components/AdSlot.vue',
      'app/components/Article/Editor/Popover.vue',
      'app/components/File/TiptapImage.vue',
      'app/components/Form/Client/AI.vue',
      'app/components/Network/Indicator.vue',
      'app/components/Tiptap/DropOverlay.vue',
      'app/pages/uzivatel/index.vue',
    ])
    expect(failuresFor(/<style(?:\s|>)/, styleAllowlist)).toEqual([])
    expect(failuresFor(/<(?:Transition|transition)(?:\s|>)/, transitionAllowlist)).toEqual([])
  })

  it('does not reintroduce hand-built fixed overlays', () => {
    expect(failuresFor(/class=["'][^"']*\bfixed\s+inset-0\b/is)).toEqual([])
  })

  it('keeps the migrated overlay and state primitives in place', () => {
    expect(sourceOf('app/components/Notification/Bar.vue')).toMatch(/<UPopover/)
    expect(sourceOf('app/components/User/Account.vue')).toMatch(/<UPopover/)
    expect(sourceOf('app/components/User/Card.vue')).toMatch(/<UPopover\s+mode="hover"/)
    expect(sourceOf('app/components/Modal/TrialExpired.vue')).toMatch(/<UModal/)
    expect(sourceOf('app/components/Article/TOC.vue')).toMatch(/<UDrawer/)
    expect(sourceOf('app/components/Article/ActionsBar.vue')).toMatch(/<USwitch/)
    expect(sourceOf('app/pages/settings/index.vue')).toMatch(/<FormClientIntegrationsCatalog/)
  })

  it('delegates dismissal and focus handling to Nuxt UI overlays', () => {
    for (const path of [
      'app/components/Notification/Bar.vue',
      'app/components/User/Account.vue',
      'app/components/User/Card.vue',
      'app/components/Client/Version.vue',
      'app/components/Modal/TrialExpired.vue',
    ]) {
      expect(sourceOf(path), path).not.toMatch(/onClickOutside|@keydown\.esc|addEventListener\(['"]keydown/)
    }
  })
})
