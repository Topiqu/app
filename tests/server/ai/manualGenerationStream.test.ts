import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/generate/index.post.ts'), 'utf8')

describe('manual article generation stream', () => {
  it('does not treat a completed POST request body as a client disconnect', () => {
    expect(endpoint).not.toMatch(/event\.node\.req\.on\(['"]close['"]/)
    expect(endpoint).toMatch(/event\.node\.res\.on\(['"]close['"], onResponseClose\)/)
    expect(endpoint).toMatch(/!event\.node\.res\.writableEnded && !textDone/)
  })

  it('removes the response listener after the stream finishes', () => {
    expect(endpoint).toMatch(/event\.node\.res\.off\(['"]close['"], onResponseClose\)/)
  })
})
