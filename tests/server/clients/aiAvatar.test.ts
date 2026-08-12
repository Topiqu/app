import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('AI author avatar access control', () => {
  const util = source('server/utils/aiUser.ts')

  it('requires an admin session', () => {
    expect(util).toContain("!['admin', 'superadmin'].includes(user.role)")
    expect(util).toMatch(/statusCode:\s*401/)
  })

  it('pins the tenant itself, because the User policy lets any admin write any row', () => {
    const roleCheck = util.indexOf("user.role !== 'superadmin' && user.clientSiteId !== clientSiteId")
    const read = util.indexOf('db.user.findFirst')

    expect(roleCheck).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(roleCheck)
  })

  it('only ever resolves the AI row of the site named in the path', () => {
    expect(util).toContain("where: { clientSiteId, role: 'ai' }")
  })

  it('refuses sites with no AI allowance', () => {
    expect(util).toContain('if (!site.tokenLimit)')
  })
})

describe('AI author avatar upload', () => {
  const post = source('server/api/clients/[id]/ai-avatar.post.ts')

  it('normalises and moderates the image before anything is persisted', () => {
    const prepare = post.indexOf('await prepareAvatar(file.data)')
    const moderate = post.indexOf('await moderateAvatar(avatar)')
    const put = post.indexOf('await putToCdn(')

    expect(prepare).toBeGreaterThan(-1)
    expect(moderate).toBeGreaterThan(prepare)
    expect(put).toBeGreaterThan(moderate)
  })

  it('authorises before it writes, not before it parses', () => {
    expect(post.indexOf('await resolveAiUser(')).toBeLessThan(post.indexOf('await putToCdn('))
  })

  it('builds the storage key from the resolved id and a server-generated uuid', () => {
    expect(post).toContain('`avatars/${aiUser!.id}/${crypto.randomUUID()}.webp`')
  })

  it('rolls the CDN object back when the row update fails', () => {
    expect(post).toMatch(/catch[\s\S]*deleteFromCdn\(key, `avatars\/\$\{aiUser!\.id\}\/`\)/)
  })

  it('scopes old-object cleanup to the same prefix', () => {
    expect(post).toContain('avatarKeyFromUrl(aiUser!.avatarUrl')
    expect(post).toContain('deleteFromCdn(oldKey, `avatars/${aiUser!.id}/`)')
  })
})

describe('settings save no longer owns the AI avatar', () => {
  const patch = source('server/api/clients/[id]/index.patch.ts')

  it('never writes avatarUrl from the settings payload', () => {
    const aiData = patch.slice(patch.indexOf('const aiData = {'), patch.indexOf('if (currentAiUser)'))

    expect(aiData).not.toContain('avatarUrl')
    expect(patch).not.toContain('optimizedAvatarUrl')
  })

  it('leaves an existing username alone when the form sends an empty one', () => {
    expect(patch).toContain('...(aiUserPayload.username ? { username: aiUserPayload.username } : {})')
  })
})
