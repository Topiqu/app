import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'

import budgets from '../../performance-budgets.json'
import {
  budgetResults,
  cssGzipBytes,
  loadInlineStyles,
  measureBuild,
  preloadedScripts,
} from '../../scripts/performance-budgets'

const resource = (file: string) => ({ file, resourceType: 'script' })
const manifest = {
  entrypoints: ['entry'],
  dependencies: {
    entry: {
      scripts: { entry: resource('entry.js') },
      preload: { shared: resource('shared.js'), font: { file: 'font.woff2', resourceType: 'font' } },
    },
    page: { scripts: { page: resource('page.js') }, preload: { shared: resource('shared.js') } },
  },
}

describe('production performance regression budgets', () => {
  it('counts mandatory scripts once across entry and route preloads, excluding fonts and lazy imports', () => {
    expect([...preloadedScripts(manifest, ['page'])]).toEqual(['entry.js', 'shared.js', 'page.js'])
  })
  it('fails closed if a Nuxt manifest changes or a required route is missing', () => {
    expect(() => preloadedScripts({}, [])).toThrow('manifest')
    expect(() => preloadedScripts(manifest, ['missing'])).toThrow('missing')
    expect(() => preloadedScripts({ ...manifest, dependencies: { entry: { scripts: {}, preload: {} } } }, [])).toThrow(
      'No initial JavaScript',
    )
  })
  it('rejects a manifest path that escapes the inspected asset directory', () => {
    expect(() =>
      preloadedScripts(
        {
          entrypoints: ['entry'],
          dependencies: {
            entry: { scripts: { entry: resource('../outside.js') }, preload: {} },
          },
        },
        [],
      ),
    ).toThrow('unsupported asset path')
  })
  it('fails on a measured regression and non-finite measurement; exact ceilings pass', () => {
    const measurements = { ...budgets.build }
    expect(budgetResults(measurements).every((result) => result.passed)).toBe(true)
    measurements.articleJsGzipBytes++
    measurements.entryJsGzipBytes = NaN
    expect(
      budgetResults(measurements)
        .filter((result) => !result.passed)
        .map((result) => result.name),
    ).toEqual(['entryJsGzipBytes', 'articleJsGzipBytes'])
  })

  it('loads SSR CSS bodies and deduplicates repeated module styles and exact external copies', async () => {
    const globalCss = 'body { color: black; }'
    const sharedCss = '.shared { display: flex; }'
    const styles = await loadInlineStyles(
      {
        entry: async () => [globalCss, ''],
        page: async () => [sharedCss],
        component: async () => [sharedCss],
      },
      ['entry'],
    )
    expect([...styles]).toEqual([globalCss, sharedCss])
    expect(cssGzipBytes([sharedCss, ...styles, ''])).toBe(
      gzipSync(globalCss).byteLength + gzipSync(sharedCss).byteLength,
    )
    expect(cssGzipBytes([globalCss, `${globalCss}\n`])).toBe(
      gzipSync(globalCss).byteLength + gzipSync(`${globalCss}\n`).byteLength,
    )
  })

  it('fails closed for missing entry CSS or changed loader/result shapes', async () => {
    await expect(loadInlineStyles(undefined, ['entry'])).rejects.toThrow('manifest')
    await expect(loadInlineStyles([], ['entry'])).rejects.toThrow('manifest')
    await expect(loadInlineStyles({ page: async () => ['.page{}'] }, ['entry'])).rejects.toThrow(
      'Missing inline stylesheet loader',
    )
    await expect(loadInlineStyles({ entry: '.entry{}' }, ['entry'])).rejects.toThrow('Invalid inline stylesheet loader')
    await expect(loadInlineStyles({ entry: async () => '.entry{}' }, ['entry'])).rejects.toThrow('expected CSS strings')
    await expect(loadInlineStyles({ entry: async () => [null] }, ['entry'])).rejects.toThrow('expected CSS strings')
    await expect(loadInlineStyles({ entry: async () => [''] }, ['entry'])).rejects.toThrow('Missing inline CSS')
  })

  it('normalizes emitted asset references and restores pre-existing Nitro globals on success and failure', async () => {
    const key = '__buildAssetsURL'
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    const existing = () => '/existing/'
    Object.defineProperty(globalThis, key, { configurable: true, value: existing })
    try {
      const loader = () => [(globalThis as unknown as Record<string, (file: string) => string>)[key]!('font.woff2')]
      await expect(loadInlineStyles({ entry: loader }, ['entry'])).resolves.toEqual(new Set(['/_nuxt/font.woff2']))
      expect(Object.getOwnPropertyDescriptor(globalThis, key)?.value).toBe(existing)
      await expect(
        loadInlineStyles(
          {
            entry: async () => {
              throw new Error('loader failed')
            },
          },
          ['entry'],
        ),
      ).rejects.toThrow('loader failed')
      expect(Object.getOwnPropertyDescriptor(globalThis, key)?.value).toBe(existing)
    } finally {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else Reflect.deleteProperty(globalThis, key)
    }
  })

  it('includes inline global CSS in the full build measurement even when it has no emitted public CSS file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'topiqu-perf-'))
    const files = ['entry.js', 'shared.js', 'page.js', 'component.css']
    const css = '.component { display: block; }'
    const globalCss = 'html { color-scheme: light dark; }'
    try {
      for (const file of files) writeFileSync(join(directory, file), file.endsWith('.css') ? css : 'export {}')
      const buildManifest = {
        ...manifest,
        dependencies: {
          ...manifest.dependencies,
          'layouts/default.vue': manifest.dependencies.page,
          'pages/index.vue': manifest.dependencies.page,
          'pages/clanky/[slug].vue': manifest.dependencies.page,
          'pages/admin/editor/[id].vue': manifest.dependencies.page,
        },
      }
      expect(measureBuild(directory, buildManifest, [globalCss, css]).totalCssGzipBytes).toBe(
        gzipSync(globalCss).byteLength + gzipSync(css).byteLength,
      )
    } finally {
      for (const file of files) unlinkSync(join(directory, file))
      rmdirSync(directory)
    }
  })
})
