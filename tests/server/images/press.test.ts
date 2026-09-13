import { describe, expect, it } from 'vitest'

import { createImageSelection } from '../../../server/utils/images/selection'
import { parsePressImages, pickPressImage } from '../../../server/utils/images/press'

describe('publisher press images', () => {
  it('takes publisher news assets, excludes branding and third-party images, and keeps distinct assets on one page', () => {
    const images = parsePressImages(
      `<h1>The Witcher IV revealed</h1>
      <img src="https://press.cdn.cdpr.app/news/a_q90_1024x576.jpeg">
      <img data-crystal-link="https://press.cdn.cdpr.app/news/a.jpeg">
      <img src="https://press.cdn.cdpr.app/news/b.jpeg">
      <img src="https://press.cdn.cdpr.app/logo.png">
      <img src="https://untrusted.test/news/x.jpg">`,
      'https://press.cdprojektred.com/en/news/1702/example',
    )
    expect(images).toHaveLength(3)
    const accept = createImageSelection()
    expect(pickPressImage(images, 'The Witcher 4 Ciri official screenshot', accept)?.url).toContain('/a_')
    expect(pickPressImage(images, 'The Witcher 4 cinematic', accept)?.url).toContain('/b.')
    expect(pickPressImage(images, 'The Witcher 4', accept)).toBeNull()
    expect(pickPressImage(images, 'The Witcher 3', createImageSelection())).toBeNull()
  })
})
