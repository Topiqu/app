import { join } from 'node:path'
import { scanExports } from 'unimport'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
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
  it('checks readiness on the runtime port and reports unhealthy responses', async () => {
    const command = read('Dockerfile').match(/HEALTHCHECK[^\n]*CMD bun -e "([^"]+)"/)?.[1]
    expect(command).toBeTruthy()

    for (const [env, expectedPort, ok] of [
      [{}, '3000', true],
      [{ PORT: '4100' }, '4100', true],
      [{ PORT: '4100', NITRO_PORT: '4200' }, '4200', false],
    ] as const) {
      const fetch = vi.fn().mockResolvedValue({ ok })
      const exit = vi.fn()
      await runInNewContext(`(async () => { ${command} })()`, { fetch, process: { env, exit }, AbortSignal })
      expect(fetch).toHaveBeenCalledWith(`http://127.0.0.1:${expectedPort}/api/health`, {
        signal: expect.any(AbortSignal),
      })
      if (ok) expect(exit).not.toHaveBeenCalled()
      else expect(exit).toHaveBeenCalledWith(1)
    }
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
    const packageJson = JSON.parse(read('package.json')) as { packageManager?: string; engines?: { bun?: string } }
    const toolVersion = packageJson.packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/)?.[1]

    expect(toolVersion).toBeTruthy()
    expect(packageJson.packageManager).toBe(`bun@${toolVersion}`)
    expect(packageJson.engines?.bun).toBe(`>=${toolVersion}`)
    expect(read('Dockerfile')).toContain(`FROM oven/bun:${toolVersion}-slim AS base`)
    const ciVersions = [...read('.github/workflows/ci.yml').matchAll(/bun-version:\s*([^\s]+)/g)].map(
      (match) => match[1],
    )
    expect(ciVersions.length).toBeGreaterThan(0)
    expect([...new Set(ciVersions)]).toEqual([toolVersion])
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
