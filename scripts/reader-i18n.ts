/**
 * Content-only locales (es, it, …) translate just what a blog reader sees. This walks the public pages,
 * the components and helpers they reach, and collects the i18n keys they use; `tests/unit/readerLocales.test.ts`
 * holds every `i18n/locales/<content locale>/reader.json` to exactly that set.
 *
 *   bun scripts/reader-i18n.ts            # per-locale missing/stale report
 *   bun scripts/reader-i18n.ts --source   # writes the English subset to translate (stdout)
 */
import { join, relative } from 'node:path'
import { readdirSync, readFileSync, statSync } from 'node:fs'

const ROOT = join(import.meta.dirname, '..')
const READER_PAGES = [
  'app/app.vue',
  'app/error.vue',
  'app/layouts/default.vue',
  'app/pages/index.vue',
  'app/pages/clanky/[slug].vue',
  'app/pages/stitky/[slug].vue',
  'app/pages/autor/[name].vue',
]
/** Dashboard-only trees: the shared layout and header mount them, but a reader never reaches them. */
const DASHBOARD_ONLY = [
  'app/components/Admin/',
  'app/components/Backlinks/',
  'app/components/Client/',
  'app/components/Dev/',
  'app/components/Form/',
  'app/components/Keywords/',
  'app/components/Knowledge/',
  'app/components/Media/',
  'app/components/Operations/',
  'app/components/Series/',
  'app/components/Settings/',
  'app/components/Stats/',
  'app/components/Tags/',
  'app/components/Tiptap/',
  'app/components/WebsiteImport/',
  'app/components/Article/Editor/',
  'app/components/Article/Drafts.vue',
  'app/components/Article/GenerationActivity.vue',
  'app/components/Article/Table.vue',
  'app/components/Article/TranslationMenu.vue',
  'app/components/Article/SeriesSelector.vue',
  'app/components/Article/StatusCell.vue',
  'app/components/Article/StatusPill.vue',
  'app/components/Sidebar.vue',
  'app/components/TenantCreate.vue',
  'app/components/TenantSwitcher.vue',
  'app/components/Exports.vue',
  'app/components/Charts.vue',
  'app/components/UnsavedBar.vue',
  'app/components/User/List.vue',
  'app/components/User/Create.vue',
  'app/components/User/Edit.vue',
  'app/components/Widget/PagePreviewSlot.vue',
]

const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((entry) => {
    const path = `${dir}/${entry}`
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : [path]
  })

const pascal = (part: string) => part.replace(/(^|[-_])(\w)/g, (_, __, c: string) => c.toUpperCase())

/** Nuxt's component name: directory segments + file name, without repeating a segment the file already starts with. */
const componentName = (file: string) => {
  const parts = relative('app/components', file)
    .replace(/\\/g, '/')
    .replace(/\.vue$/, '')
    .split('/')
    .map(pascal)
  const name = parts.pop()!
  if (name === 'Index') return parts.join('')
  const prefix = parts.join('')
  return prefix && name.startsWith(prefix) ? name : prefix + name
}

const components = new Map(
  walk('app/components')
    .filter((f) => f.endsWith('.vue'))
    .map((f) => [componentName(f), f]),
)

const exportsOf = (dir: string) =>
  walk(dir)
    .filter((f) => /\.ts$/.test(f))
    .flatMap((file) =>
      [...readFileSync(join(ROOT, file), 'utf8').matchAll(/export (?:const|function|async function) (\w+)/g)].map(
        (m) => [m[1]!, file] as const,
      ),
    )
const helpers = new Map([...exportsOf('app/composables'), ...exportsOf('app/utils'), ...exportsOf('shared/utils')])

const isDashboardOnly = (file: string) => DASHBOARD_ONLY.some((prefix) => file.startsWith(prefix))

export const readerFiles = (): Set<string> => {
  const seen = new Set<string>()
  const queue = [...READER_PAGES]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file) || isDashboardOnly(file)) continue
    seen.add(file)
    const source = readFileSync(join(ROOT, file), 'utf8')
    for (const [, lazy, tag] of source.matchAll(/<(Lazy)?([A-Z][A-Za-z0-9]+)/g)) {
      const target = components.get(tag!) ?? (lazy ? undefined : components.get(tag!.replace(/^Lazy/, '')))
      if (target) queue.push(target)
    }
    for (const [, kebab] of source.matchAll(/<(?:lazy-)?([a-z]+(?:-[a-z0-9]+)+)/g)) {
      const target = components.get(pascal(kebab!))
      if (target) queue.push(target)
    }
    for (const [name, target] of helpers) if (new RegExp(`\\b${name}\\b`).test(source)) queue.push(target)
  }
  return seen
}

type Messages = { [key: string]: string | Messages }

const merge = (target: Messages, source: Messages): Messages => {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key]
    target[key] = typeof value === 'object' && typeof current === 'object' ? merge(current, value) : value
  }
  return target
}

export const localeMessages = (locale: string): Messages => {
  const dir = join(ROOT, 'i18n/locales', locale)
  const merged: Messages = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')))
    merge(merged, JSON.parse(readFileSync(join(dir, file), 'utf8')))
  return merged
}

const leaves = (messages: Messages, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )

export const readerKeys = (): Set<string> => {
  const all = leaves(localeMessages('en'))
  const keys = new Set<string>()
  const take = (path: string) => {
    for (const key of all) if (key === path || key.startsWith(`${path}.`)) keys.add(key)
  }
  for (const file of readerFiles()) {
    const source = readFileSync(join(ROOT, file), 'utf8')
    // Any literal naming a key or a subtree; `'a.b.' + x` and `` `a.b.${x}` `` take the whole subtree.
    for (const [, literal] of source.matchAll(/['"`]([a-zA-Z][\w-]*(?:\.[\w-]+)*\.?)(?:['"`]|\$\{)/g)) {
      // A bare word ('articles') is a route or API name far more often than a namespace.
      if (literal!.includes('.')) take(literal!.replace(/\.$/, ''))
    }
  }
  return keys
}

export const pick = (messages: Messages, keys: Iterable<string>): Messages => {
  const out: Messages = {}
  for (const key of keys) {
    const parts = key.split('.')
    let from: string | Messages | undefined = messages
    let to = out
    for (const [index, part] of parts.entries()) {
      from = typeof from === 'object' ? from[part] : undefined
      if (from === undefined) break
      if (index === parts.length - 1) to[part] = from
      else to = (to[part] ??= {}) as Messages
    }
  }
  return out
}

export const CONTENT_ONLY_LOCALES = ['es', 'it', 'pl', 'sk', 'nl', 'pt'] as const

if (import.meta.main) {
  const keys = readerKeys()
  if (process.argv.includes('--source')) {
    console.log(JSON.stringify(pick(localeMessages('en'), [...keys].sort()), null, 2))
  } else {
    console.log(`${keys.size} reader keys from ${readerFiles().size} files`)
    for (const locale of CONTENT_ONLY_LOCALES) {
      let present = new Set<string>()
      try {
        present = new Set(leaves(JSON.parse(readFileSync(join(ROOT, `i18n/locales/${locale}/reader.json`), 'utf8'))))
      } catch {
        // Not written yet: everything is missing.
      }
      const missing = [...keys].filter((key) => !present.has(key))
      const stale = [...present].filter((key) => !keys.has(key))
      console.log(`${locale}: ${missing.length} missing, ${stale.length} stale`)
    }
  }
}

export { leaves }
