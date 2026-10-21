// @vitest-environment node
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, existsSync } from 'node:fs'

const run = (migrationExit: number, databaseUrl: string | undefined = 'postgresql://fixture/app') => {
  const directory = mkdtempSync(join(tmpdir(), 'topiqu-entrypoint-'))
  const script = join(directory, 'entrypoint.sh')
  const executable = join(directory, 'bun')
  const log = join(directory, 'calls')
  try {
    writeFileSync(script, readFileSync('scripts/docker-entrypoint.sh'))
    writeFileSync(
      executable,
      `#!/bin/sh
if [ "$2" = "migrate/node_modules/prisma/build/index.js" ]; then
  printf 'migrate:%s\\n' "$DATABASE_URL" >> "$ENTRYPOINT_LOG"
  exit "$MIGRATION_EXIT"
fi
printf 'server:%s\\n' "$DATABASE_URL" >> "$ENTRYPOINT_LOG"
`,
      { mode: 0o700 },
    )
    const result = spawnSync('/bin/sh', [script], {
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        ENTRYPOINT_LOG: log,
        MIGRATION_EXIT: String(migrationExit),
        ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
        DIRECT_DATABASE_URL: 'postgresql://fixture/direct',
      },
      encoding: 'utf8',
    })
    return { status: result.status, calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] }
  } finally {
    for (const file of [script, executable, log]) if (existsSync(file)) unlinkSync(file)
    rmdirSync(directory)
  }
}

describe('container migration gate', () => {
  it('migrates through the direct connection before starting the app with its original connection', () => {
    expect(run(0)).toEqual({
      status: 0,
      calls: ['migrate:postgresql://fixture/direct', 'server:postgresql://fixture/app'],
    })
  })
  it('never starts the application when migration fails', () => {
    expect(run(7)).toEqual({ status: 7, calls: ['migrate:postgresql://fixture/direct'] })
  })
  it('fails before running commands when DATABASE_URL is absent', () => {
    const result = run(0, '')
    expect(result.status).not.toBe(0)
    expect(result.calls).toEqual([])
  })
})
