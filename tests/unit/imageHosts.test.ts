import { describe, expect, it } from 'vitest'

import { canOptimizeImageUrl } from '../../shared/utils/imageHosts'

describe('canOptimizeImageUrl', () => {
  it('accepts local assets and configured public CDN hosts', () => {
    expect(canOptimizeImageUrl('/app-logo.png')).toBe(true)
    expect(canOptimizeImageUrl('https://cdn.topiqu.com/article-images/a.png')).toBe(true)
  })

  it('rejects private, untrusted, protocol-relative and signed URLs', () => {
    expect(canOptimizeImageUrl('/api/private-image?id=1')).toBe(false)
    expect(canOptimizeImageUrl('https://media.giphy.com/a.gif')).toBe(false)
    expect(canOptimizeImageUrl('//cdn.topiqu.com/a.png')).toBe(false)
    expect(canOptimizeImageUrl('https://cdn.topiqu.com/a.png?X-Amz-Signature=secret')).toBe(false)
  })
})
