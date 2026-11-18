import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

// The SSR build leaves a module reached only through `../shared/…` from `extensions/` out of the bundle and
// rewrites the path one level above the project, so the server build failed to resolve it. `~~/shared/…` is bundled.
describe('Tiptap extensions', () => {
  it('import shared code through the ~~ alias, never a relative path', () => {
    const dir = join(process.cwd(), 'extensions')
    const relative = readdirSync(dir)
      .filter((name) => /\.(ts|vue)$/.test(name))
      .filter((name) => /from ['"]\.\.\/shared\//.test(readFileSync(join(dir, name), 'utf8')))
    expect(relative).toEqual([])
  })
})
