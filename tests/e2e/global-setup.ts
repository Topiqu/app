import { spawnSync } from 'node:child_process'

export default function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL
  if (!databaseUrl || !/test/i.test(databaseUrl)) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated test database.')
  }

  const bunExecutable = 'bun' in process.versions ? process.execPath : (process.env.BUN_EXE ?? 'bun')

  const result = spawnSync(bunExecutable, ['prisma/seed.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    throw new Error(`Could not seed browser fixtures.\n${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`)
  }
}
