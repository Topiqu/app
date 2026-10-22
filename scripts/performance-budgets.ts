import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { basename, join, resolve } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'

import budgets from '../performance-budgets.json'

interface Resource {
  file?: string
  resourceType?: string
}
interface PrecomputedManifest {
  entrypoints: string[]
  dependencies: Record<string, { scripts: Record<string, Resource>; preload: Record<string, Resource> }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const loadInlineStyles = async (input: unknown, requiredModules: string[]): Promise<Set<string>> => {
  if (!isRecord(input) || !Object.keys(input).length)
    throw new Error('Missing Nitro SSR style manifest; review the performance budget adapter.')
  for (const module of requiredModules)
    if (!Object.hasOwn(input, module)) throw new Error(`Missing inline stylesheet loader for ${module}.`)

  // Emitted CSS modules use Nitro globals for font/image URLs. Normalize those URLs without starting Nitro.
  const resolvers = {
    __buildAssetsURL: (...paths: string[]) => `/_nuxt/${paths.map((path) => path.replace(/^\/+|\/+$/g, '')).join('/')}`,
    __publicAssetsURL: (...paths: string[]) => `/${paths.map((path) => path.replace(/^\/+|\/+$/g, '')).join('/')}`,
  }
  const previous = Object.keys(resolvers).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  const styles = new Set<string>()
  try {
    for (const [key, value] of Object.entries(resolvers))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
    for (const [module, loader] of Object.entries(input)) {
      if (typeof loader !== 'function') throw new Error(`Invalid inline stylesheet loader for ${module}.`)
      const result: unknown = await loader()
      if (!Array.isArray(result) || result.some((style) => typeof style !== 'string'))
        throw new Error(`Invalid inline stylesheet result for ${module}; expected CSS strings.`)
      if (requiredModules.includes(module) && !result.some((style) => style.length > 0))
        throw new Error(`Missing inline CSS for required entry ${module}.`)
      for (const style of result) if (style.length) styles.add(style)
    }
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
  return styles
}

export const cssGzipBytes = (styles: Iterable<string>) =>
  [...new Set(styles)].reduce((total, style) => total + (style.length ? gzipSync(style).byteLength : 0), 0)

export const preloadedScripts = (input: unknown, modules: string[]): Set<string> => {
  if (!isRecord(input) || !Array.isArray(input.entrypoints) || !isRecord(input.dependencies))
    throw new Error('Missing Nitro client manifest. Run bun run build first.')
  const manifest = input as unknown as PrecomputedManifest
  const files = new Set<string>()
  for (const module of [...manifest.entrypoints, ...modules]) {
    const dependency = manifest.dependencies[module]
    if (!dependency || !isRecord(dependency.scripts) || !isRecord(dependency.preload))
      throw new Error(`Client manifest is missing ${module}; review the performance budget adapter.`)
    for (const resource of Object.values({ ...dependency.scripts, ...dependency.preload })) {
      if (resource.resourceType !== 'script') continue
      if (!resource.file || basename(resource.file) !== resource.file || !resource.file.endsWith('.js'))
        throw new Error('Client manifest contains an unsupported asset path.')
      files.add(resource.file)
    }
  }
  if (!files.size) throw new Error('No initial JavaScript found in the production client manifest.')
  return files
}

export const budgetResults = (measurements: Record<keyof typeof budgets.build, number>) =>
  Object.entries(budgets.build).map(([name, limit]) => ({
    name,
    limit,
    measured: measurements[name as keyof typeof budgets.build],
    passed:
      Number.isFinite(measurements[name as keyof typeof budgets.build]) &&
      measurements[name as keyof typeof budgets.build] <= limit,
  }))

export const measureBuild = (directory: string, manifest: unknown, inlineStyles: Iterable<string>) => {
  const sizes = new Map(
    readdirSync(directory)
      .filter((file) => /\.(js|css)$/.test(file))
      .map((file) => [file, gzipSync(readFileSync(join(directory, file))).byteLength]),
  )
  const sum = (files: Iterable<string>) =>
    [...files].reduce((total, file) => {
      const bytes = sizes.get(file)
      if (bytes === undefined) throw new Error(`Missing built asset: ${file}`)
      return total + bytes
    }, 0)
  const js = [...sizes.keys()].filter((file) => file.endsWith('.js'))
  const css = [...sizes.keys()].filter((file) => file.endsWith('.css'))
  const pageBytes = (page: string) => sum(preloadedScripts(manifest, ['layouts/default.vue', page]))
  return {
    entryJsGzipBytes: sum(preloadedScripts(manifest, [])),
    publicationJsGzipBytes: pageBytes('pages/index.vue'),
    articleJsGzipBytes: pageBytes('pages/clanky/[slug].vue'),
    editorShellJsGzipBytes: pageBytes('pages/admin/editor/[id].vue'),
    largestJsGzipBytes: Math.max(...js.map((file) => sizes.get(file)!)),
    totalJsGzipBytes: sum(js),
    totalCssGzipBytes: cssGzipBytes([
      ...css.map((file) => readFileSync(join(directory, file), 'utf8')),
      ...inlineStyles,
    ]),
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(process.argv[2] ?? '.')
  const { default: manifest } = await import(
    pathToFileURL(join(root, '.output/server/chunks/virtual/precomputed.mjs')).href
  )
  preloadedScripts(manifest, [])
  const { default: styleManifest } = await import(
    pathToFileURL(join(root, '.output/server/chunks/virtual/styles.mjs')).href
  )
  const styles = await loadInlineStyles(styleManifest, manifest.entrypoints)
  const results = budgetResults(measureBuild(join(root, '.output/public/_nuxt'), manifest, styles))
  for (const result of results)
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.measured} / ${result.limit} bytes gzip`)
  console.log(
    `Field p75 targets: LCP ${budgets.fieldP75.LCP}ms, INP ${budgets.fieldP75.INP}ms, CLS ${budgets.fieldP75.CLS}. Production samples are required to evaluate these.`,
  )
  if (results.some((result) => !result.passed)) process.exitCode = 1
}
