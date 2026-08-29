import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const util = source('server/utils/anonSession.ts')
const reaction = source('server/api/articles/[id]/reaction.post.ts')

const serverFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? serverFiles(path) : entry.name.endsWith('.ts') ? [path] : []
  })

describe('anonymous visitor identity', () => {
  it('hardens the cookie in one place', () => {
    expect(util).toContain('httpOnly: true')
    expect(util).toContain("sameSite: 'lax'")
    // Assembled, not written literally: a bare `import.meta.dev` here is substituted at transform time.
    expect(util).toContain(`secure: !import${'.'}meta.dev`)
  })

  // Endpoints drifting apart is what let a like be stored under one identity and read under another.
  it('leaves every touch of the cookie to the shared util', () => {
    const direct = serverFiles(resolve(process.cwd(), 'server'))
      .filter((path) => !path.endsWith(join('utils', 'anonSession.ts')))
      .filter((path) => /(?:get|set)Cookie\(\s*event,\s*'anon_session'/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(process.cwd(), path))

    expect(direct).toEqual([])
  })

  it('resolves the liker from the session or the cookie, never from the body', () => {
    expect(reaction).toContain('issueAnonSession(event)')
    expect(reaction).not.toContain('body.visitorId')
    expect(reaction).not.toContain('readValidatedBody')
  })

  // A GET that mints an identity hands one to every crawler and to a reader who never voted.
  it('keeps the poll read path from issuing an identity', () => {
    expect(source('server/api/articles/[id]/vote.ts')).toContain('readAnonSession(event)')
    expect(source('server/api/articles/[id]/vote.post.ts')).toContain('issueAnonSession(event)')
  })

  // What the FingerprintJS identity was reaching for, put somewhere the caller cannot pick it.
  it('meters anonymous likes per IP, and only where a count can grow', () => {
    expect(reaction).toContain('consumeRateLimit(`reaction:article:${id}:${ip}`')
    expect(reaction).toContain('consumeRateLimit(`reaction:ip:${ip}`')
    expect(reaction).toContain('ipKey(event)')
    expect(reaction).toContain('statusCode: 429')
    expect(reaction.indexOf('deleteMany')).toBeLessThan(reaction.indexOf('consumeRateLimit'))
  })

  it('peppers the IP before it becomes a cache key', () => {
    const ip = source('server/utils/ip.ts')
    expect(ip).toContain("createHmac('sha256', process.env.AUTH_SECRET")
  })

  it('stops the client from sending a visitor id to the reaction endpoint', () => {
    for (const path of ['app/components/Article/Card.vue', 'app/pages/clanky/[slug].vue']) {
      const like = source(path).split('/reaction`')[1]?.slice(0, 200) ?? ''
      expect(like).not.toContain('visitorId')
    }
  })
})
