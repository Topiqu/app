import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

const script = join(process.cwd(), 'scripts/verify-backup-restore.ts')
const sourceDatabase = 'topiqu_preferences_test'
const container = 'topiqu-nonexistent-restore-test'
const syntheticSecret = 'synthetic-backup-cli-secret-not-a-real-credential'

const run = (args: string[]) => {
  const result = spawnSync('bun', ['--no-env-file', script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      DOCKER_HOST: 'ssh://restore-test.invalid',
      DATABASE_URL: `postgresql://synthetic:${syntheticSecret}@database.invalid/private`,
      POSTGRES_PASSWORD: syntheticSecret,
      AUTH_SECRET: syntheticSecret,
    },
  })
  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  expect(result.stdout + result.stderr).not.toContain(syntheticSecret)
  expect(result.stdout + result.stderr).not.toContain('database.invalid')
  expect(result.stdout + result.stderr).not.toContain('restore-test.invalid')
  return result
}

describe('backup restore CLI safety guards', () => {
  it('plans without contacting Docker, inspecting environment files or retaining a target', () => {
    const result = run(['--container', container, '--source-db', sourceDatabase])
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const plan = JSON.parse(result.stdout)
    expect(plan).toMatchObject({
      schemaVersion: 1,
      mode: 'dry-run',
      status: 'planned',
      stage: 'plan',
      container,
      sourceDatabase,
      targetCreated: false,
      targetRetained: false,
      backup: { format: 'custom', storage: 'stream', persisted: false },
      source: null,
      restored: null,
      verification: null,
      failure: null,
    })
    expect(plan.targetDatabase).toMatch(/^topiqu_restore_drill_\d{14}_[a-f0-9]{8}$/)
    expect(plan.targetDatabase).not.toBe(sourceDatabase)
  })

  it('generates a new disposable target name for each invocation', () => {
    const args = ['--container', container, '--source-db', sourceDatabase]
    const first = JSON.parse(run(args).stdout)
    const second = JSON.parse(run(args).stdout)
    expect(first.targetDatabase).not.toBe(second.targetDatabase)
  })

  it.each([
    'topiqu_prod_test',
    'topiqu_production_test',
    'production',
    'postgres',
    'topiqu',
    'topiqu_testing',
    'test;DROP DATABASE postgres',
    'test$(printf unsafe)',
    'postgresql://synthetic:password@database.invalid/test',
    `test_${'x'.repeat(64)}`,
  ])('rejects an unsafe source before any apply operation: %s', (source) => {
    const result = run(['--container', container, '--source-db', source, '--apply'])
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Source must be an explicitly named local test, drill or scratch database')
  })

  it.each(['--privileged', 'bad/container', 'test;printf unsafe', 'test$(printf unsafe)'])(
    'rejects an invalid container identifier: %s',
    (name) => {
      const result = run(['--source-db', sourceDatabase, '--container', name])
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
    },
  )

  it.each([
    ['--unknown'],
    ['--source-db'],
    ['--container', container, '--container', container, '--source-db', sourceDatabase],
    ['--container', container, '--source-db', sourceDatabase, '--source-db', sourceDatabase],
    ['--container', container, '--source-db', sourceDatabase, '--apply', '--apply'],
    ['--container', container, '--source-db', sourceDatabase, '--target-db', 'postgres'],
  ])('rejects unknown, repeated or incomplete options: %j', (...args) => {
    const result = run(args)
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Usage: bun --no-env-file')
  })
})
