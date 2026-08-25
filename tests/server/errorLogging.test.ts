import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const plugin = readFileSync(resolve(process.cwd(), 'server/plugins/errorLogging.ts'), 'utf8')

describe('Nitro error logging', () => {
  it('logs forbidden boundaries without leaking query strings', () => {
    expect(plugin).toContain('if (statusCode === 403)')
    expect(plugin).toContain('logger.warn')
    expect(plugin).toContain('getRequestURL(event).pathname')
    expect(plugin).not.toContain('event?.path')
  })
})
