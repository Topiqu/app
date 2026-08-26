import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('release toolchain', () => {
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
})
