import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

export default function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl || !/test/i.test(databaseUrl)) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated test database.')
  }

  const bunCandidates = [
    process.env.BUN_EXE,
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, 'bin/bun') : undefined,
    join(homedir(), '.bun/bin/bun'),
    'bun',
  ].filter((candidate): candidate is string => Boolean(candidate))
  const bunExecutable = bunCandidates.find((candidate) => candidate === 'bun' || existsSync(candidate)) ?? 'bun'

  const result = spawnSync(bunExecutable, ['prisma/seed.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`Could not seed browser fixtures.\n${result.stdout}\n${result.stderr}`)
  }
}
