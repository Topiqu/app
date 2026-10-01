import { describe, expect, it } from 'vitest'

import { isCoverImageUrl } from '../../../server/utils/images/cdn'

const stock = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Board.jpg/1280px-Board.jpg'

describe('article cover URLs', () => {
  it('accepts a stock cover only as the media asset registered for it', () => {
    expect(isCoverImageUrl(null)).toBe(true)
    expect(isCoverImageUrl(stock, { url: stock, deliveryUrl: stock })).toBe(true)
    expect(isCoverImageUrl(stock)).toBe(false)
    expect(isCoverImageUrl('http://169.254.169.254/latest', { url: stock, deliveryUrl: null })).toBe(false)
  })
})
