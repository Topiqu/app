import { dirname, join, relative } from 'node:path'
import { mkdir, readdir, symlink } from 'node:fs/promises'

const versionedPackages = async (root: string) => {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const packages: { name: string; dir: string }[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.startsWith('@')) {
      packages.push({ name: entry.name.slice(0, entry.name.lastIndexOf('@')), dir: join(root, entry.name) })
      continue
    }
    for (const scoped of await readdir(join(root, entry.name))) {
      const name = `${entry.name}/${scoped.slice(0, scoped.lastIndexOf('@'))}`
      packages.push({ name, dir: join(root, entry.name, scoped) })
    }
  }
  return packages
}

/**
 * Nitro keeps a second version of a package in `.nitro/<name>@<version>`, while `node_modules/<name>` is another
 * version. A package importing itself by name, as `@noble/hashes` 1.x does, then resolves to that other version
 * under Bun. A link inside the versioned directory makes the import find the package itself.
 */
export const linkNitroSelfReferences = async (serverDir: string) => {
  for (const { name, dir } of await versionedPackages(join(serverDir, 'node_modules', '.nitro'))) {
    const link = join(dir, 'node_modules', name)
    await mkdir(dirname(link), { recursive: true })
    await symlink(relative(dirname(link), dir), link, 'junction')
  }
}
