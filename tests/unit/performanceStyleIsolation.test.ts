import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'

it('reads Bun-preset CSS without executing the server and rejects unexpected imports', () => {
  const directory = mkdtempSync(join(tmpdir(), 'topiqu-css-isolation-'))
  const chunks = join(directory, 'chunks')
  const build = join(chunks, 'build')
  const virtual = join(chunks, 'virtual')
  const manifest = join(virtual, 'styles.mjs')
  const entry = join(build, 'entry-styles.test.mjs')
  const server = join(directory, 'index.mjs')
  const script = join(process.cwd(), 'scripts/performance-budgets.ts')
  const command = `
    import { readStyleManifest, loadInlineStyles } from ${JSON.stringify(script)};
    const styles = await loadInlineStyles(await readStyleManifest(${JSON.stringify(manifest)}), ['entry']);
    console.log(JSON.stringify([...styles]));
  `
  mkdirSync(chunks)
  mkdirSync(build)
  mkdirSync(virtual)
  writeFileSync(server, 'throw new Error("SERVER_STARTED"); export const jo = () => "wrong";')
  writeFileSync(
    manifest,
    'export default { entry: () => import("../build/entry-styles.test.mjs").then(m => m.default) };',
  )
  writeFileSync(
    entry,
    `void 0;import { jo as buildAssetsURL } from '../../index.mjs';
import '../../index.mjs';
export default ['@font-face{src:url(' + buildAssetsURL('font.woff2') + ')}'];`,
  )
  try {
    expect(JSON.parse(execFileSync('bun', ['--no-env-file', '-e', command], { encoding: 'utf8' }))).toEqual([
      '@font-face{src:url(/_nuxt/font.woff2)}',
    ])
    writeFileSync(entry, `import { jo } from '../../index.mjs'; export default [jo()];`)
    let failure = ''
    try {
      execFileSync('bun', ['--no-env-file', '-e', command], { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      failure = String((error as { stderr?: string }).stderr)
    }
    expect(failure).toContain('Unsupported dependency in Nitro style graph')
    expect(failure).not.toContain('SERVER_STARTED')
  } finally {
    for (const file of [manifest, entry, server]) unlinkSync(file)
    for (const path of [build, virtual, chunks, dirname(server)]) rmdirSync(path)
  }
})
