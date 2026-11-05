// @vitest-environment node
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'

import { linkNitroSelfReferences } from '../../scripts/linkNitroSelfReferences'

describe('linkNitroSelfReferences', () => {
  let serverDir: string

  const writeVersion = async (folder: string, version: string) => {
    const dir = join(serverDir, 'node_modules', '.nitro', folder)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version }))
  }
  const linkedVersion = async (folder: string, name: string) =>
    JSON.parse(
      await readFile(join(serverDir, 'node_modules', '.nitro', folder, 'node_modules', name, 'package.json'), 'utf8'),
    ).version

  beforeEach(async () => {
    serverDir = await mkdtemp(join(tmpdir(), 'topiqu-nitro-links-'))
  })

  afterEach(async () => {
    await rm(serverDir, { recursive: true, force: true })
  })

  it('makes a scoped package reach its own version instead of the hoisted one', async () => {
    await writeVersion('@noble/hashes@1.8.0', '1.8.0')
    await writeVersion('@noble/hashes@2.4.0', '2.4.0')

    await linkNitroSelfReferences(serverDir)

    await expect(linkedVersion('@noble/hashes@1.8.0', '@noble/hashes')).resolves.toBe('1.8.0')
    await expect(linkedVersion('@noble/hashes@2.4.0', '@noble/hashes')).resolves.toBe('2.4.0')
  })

  it('handles an unscoped package', async () => {
    await writeVersion('left-pad@1.3.0', '1.3.0')

    await linkNitroSelfReferences(serverDir)

    await expect(linkedVersion('left-pad@1.3.0', 'left-pad')).resolves.toBe('1.3.0')
  })

  it('does nothing when no package needed a second version', async () => {
    await expect(linkNitroSelfReferences(serverDir)).resolves.toBeUndefined()
  })
})
