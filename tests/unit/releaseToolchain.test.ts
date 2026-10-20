import { join } from 'node:path'
import { scanExports } from 'unimport'
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('release toolchain', () => {
  it('does not register generic type parameters as Nitro runtime auto-imports', async () => {
    const exports = await scanExports(join(root, 'server/utils/backlinks/page.ts'))
    expect(exports.map((entry) => entry.name)).toContain('mapLimit')
    expect(exports.map((entry) => entry.name)).not.toContain('R')
    expect(exports.map((entry) => entry.name)).not.toContain('T')
  })
  it('never migrates a database while building an image and runs the server without root privileges', () => {
    const docker = read('Dockerfile')
    expect(docker).not.toMatch(/RUN\s+bun\s+(?:run\s+)?(?:release|db:migrate)/)
    expect(docker).not.toContain('ARG DATABASE_URL')
    expect(docker).toContain('USER bun')
    expect(docker).toContain('HEALTHCHECK')
  })
  it('registers every scheduled task, including expiry and DNS revalidation', () => {
    const config = read('nuxt.config.ts')
    for (const file of readdirSync(join(root, 'server/tasks')).filter((name) => name.endsWith('.ts')))
      expect(config).toContain(`'${file.slice(0, -3)}'`)
  })
  it('does not persist authenticated network responses in the service worker', () => {
    expect(read('nuxt.config.ts')).toContain('runtimeCaching: []')
    expect(read('public/sw-cache-cleanup.js')).toContain("caches.delete('api-cache')")
  })
  it('pins one Bun version across local, CI and Docker builds', () => {
    const packageJson = JSON.parse(read('package.json')) as { packageManager?: string }
    const toolVersion = read('.prototools').match(/^bun = "([^"]+)"$/m)?.[1]

    expect(toolVersion).toBeTruthy()
    expect(packageJson.packageManager).toBe(`bun@${toolVersion}`)
    expect(read('Dockerfile')).toContain(`FROM oven/bun:${toolVersion}-slim AS base`)
    expect(read('.github/workflows/ci.yml')).toContain(`bun-version: ${toolVersion}`)
  })

  it('gates releases on a frozen lockfile and compiled browser smoke test', () => {
    const workflow = read('.github/workflows/ci.yml')

    expect(workflow).toContain('bun --bun install --shamefully-hoist --frozen-lockfile')
    expect(workflow).toContain('bun run build:docker')
    expect(workflow).toContain('bun run test:e2e:release')
  })

  it('keeps every Prisma migration executable on a clean database', () => {
    const migrations = join(root, 'prisma/migrations')
    const missingSql = readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !existsSync(join(migrations, name, 'migration.sql')))

    expect(missingSql).toEqual([])
  })

  it('keeps every TipTap package on one exact version', () => {
    const packageJson = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    const versions = new Set(
      Object.entries(packageJson.dependencies)
        .filter(([name]) => name.startsWith('@tiptap/'))
        .map(([, version]) => version),
    )
    expect(versions.size).toBe(1)
    expect([...versions][0]).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
