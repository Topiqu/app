import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { AVATAR_SIZE, avatarKeyFromUrl, prepareAvatar } from '../../../server/utils/avatar'

describe('avatar processing', () => {
  it('decodes, auto-orients, crops and emits a square WebP', async () => {
    const source = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 20, g: 80, b: 160 } },
    })
      .jpeg()
      .toBuffer()

    const result = await prepareAvatar(source)
    const metadata = await sharp(result).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(AVATAR_SIZE)
    expect(metadata.height).toBe(AVATAR_SIZE)
  })

  it('rejects bytes that are not an image', async () => {
    await expect(prepareAvatar(Buffer.from('not an image'))).rejects.toMatchObject({ statusCode: 415 })
  })

  it('only derives deletion keys for managed avatar objects', () => {
    expect(avatarKeyFromUrl('https://cdn.topiqu.com/avatars/user-1/a.webp', 'https://cdn.topiqu.com')).toBe(
      'avatars/user-1/a.webp',
    )
    expect(avatarKeyFromUrl('https://example.com/photo.jpg', 'https://cdn.topiqu.com')).toBeNull()
    expect(
      avatarKeyFromUrl('https://cdn.topiqu.com.evil.test/avatars/user-1/a.webp', 'https://cdn.topiqu.com'),
    ).toBeNull()
    expect(avatarKeyFromUrl('https://cdn.topiqu.com/uploads/old.jpg', 'https://cdn.topiqu.com')).toBeNull()
  })
})
