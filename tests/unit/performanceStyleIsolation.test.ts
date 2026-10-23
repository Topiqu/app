import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'

it.each(['../../index.mjs', '../nitro/nitro.mjs'])(
  'reads Bun-preset CSS from %s without executing the server and rejects unexpected imports',
  (runtimeImport) => {
    const directory = mkdtempSync(join(tmpdir(), 'topiqu-css-isolation-'))
    const chunks = join(directory, 'chunks')
    const build = join(chunks, 'build')
    const virtual = join(chunks, 'virtual')
    const manifest = join(virtual, 'styles.mjs')
    const entry = join(build, 'entry-styles.test.mjs')
    const server = join(directory, 'index.mjs')
    const nitroDirectory = join(chunks, 'nitro')
    const nitro = join(nitroDirectory, 'nitro.mjs')
    const script = join(process.cwd(), 'scripts/performance-budgets.ts')
    const command = `
    import { readStyleManifest, loadInlineStyles } from ${JSON.stringify(script)};
    const styles = await loadInlineStyles(await readStyleManifest(${JSON.stringify(manifest)}), ['entry']);
    console.log(JSON.stringify([...styles]));
  `
    mkdirSync(chunks)
    mkdirSync(build)
    mkdirSync(virtual)
    mkdirSync(nitroDirectory)
    for (const runtime of [server, nitro])
      writeFileSync(
        runtime,
        'throw new Error("SERVER_STARTED"); export const jo = () => "wrong"; export const jp = jo;',
      )
    writeFileSync(
      manifest,
      'export default { entry: () => import("../build/entry-styles.test.mjs").then(m => m.default) };',
    )
    writeFileSync(
      entry,
      `void 0;import { jo as buildAssetsURL } from '${runtimeImport}';
import { jp as publicAssetsURL } from '${runtimeImport}';
import '${runtimeImport}';
export default ['@font-face{src:url(' + buildAssetsURL('font.woff2') + ')}', 'div{background:url(' + publicAssetsURL('hero.png') + ')}'];`,
    )
    try {
      expect(JSON.parse(execFileSync('bun', ['--no-env-file', '-e', command], { encoding: 'utf8' }))).toEqual([
        '@font-face{src:url(/_nuxt/font.woff2)}',
        'div{background:url(/hero.png)}',
      ])
      writeFileSync(entry, `import { jo } from '${runtimeImport}'; export default [jo()];`)
      let failure = ''
      try {
        execFileSync('bun', ['--no-env-file', '-e', command], { encoding: 'utf8', stdio: 'pipe' })
      } catch (error) {
        failure = String((error as { stderr?: string }).stderr)
      }
      expect(failure).toContain('Unsupported dependency in Nitro style graph')
      expect(failure).not.toContain('SERVER_STARTED')
      writeFileSync(
        entry,
        `import { jo as buildAssetsURL } from '../nitro/not-nitro.mjs'; export default [buildAssetsURL()];`,
      )
      failure = ''
      try {
        execFileSync('bun', ['--no-env-file', '-e', command], { encoding: 'utf8', stdio: 'pipe' })
      } catch (error) {
        failure = String((error as { stderr?: string }).stderr)
      }
      expect(failure).toContain('Unsupported dependency in Nitro style graph')
      expect(failure).not.toContain('SERVER_STARTED')
    } finally {
      for (const file of [manifest, entry, server, nitro]) unlinkSync(file)
      for (const path of [build, virtual, nitroDirectory, chunks, dirname(server)]) rmdirSync(path)
    }
  },
)
