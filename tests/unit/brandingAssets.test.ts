import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { imageFrameScale } from '../../app/composables/useAvatarCropper'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('publication brand assets', () => {
  it('keeps complete images visible in contain mode and fills the frame in crop mode', () => {
    expect(imageFrameScale(1600, 500, 320, 100, 'contain')).toBe(0.2)
    expect(imageFrameScale(1600, 500, 320, 320, 'contain')).toBe(0.2)
    expect(imageFrameScale(1600, 500, 320, 320, 'cover')).toBe(0.64)
  })

  it('uses the crop editor for both logo and favicon settings', () => {
    const branding = source('app/components/Form/Client/Branding.vue')
    const uploader = source('app/components/Form/Client/LogoUploader.vue')

    expect(branding.match(/<FormClientLogoUploader/g)).toHaveLength(2)
    expect(branding).toContain('assetType="favicon"')
    expect(branding).not.toContain('type="client-logo"')
    expect(branding).not.toContain('type="client-favicon"')
    expect(uploader).toContain("displayMode = shallowRef<'contain' | 'cover'>('contain')")
    expect(uploader).toContain('const outputWidth = isFavicon.value ? 256 : 1280')
    expect(uploader).toContain('const outputHeight = isFavicon.value ? 256 : 400')
    expect(uploader).toContain("isFavicon.value ? 'client-favicon' : 'client-logo'")
  })

  it('builds the editor from system primitives instead of a restyled button', () => {
    const uploader = source('app/components/Form/Client/LogoUploader.vue')
    const styles = source('app/assets/styles/main.css')

    // A bare <UButton> defaults to solid primary, which is what turned the whole dropzone into a blue slab.
    expect(uploader).toContain('<UFileUpload')
    expect(uploader).toContain('<UModal')
    expect(uploader).toContain('<USlider')
    expect(uploader).not.toContain('h-56')
    expect(uploader).not.toContain('type="range"')
    // The checkerboard reads transparency from theme tokens, so it no longer needs a hardcoded gray per color scheme.
    expect(uploader).toContain('transparency-grid')
    expect(uploader).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(styles).toContain('.transparency-grid')
    expect(styles).toContain('--transparency-square: var(--ui-bg-accented)')
  })

  it('renders the normalized wide logo without requesting a square crop', () => {
    const header = source('app/components/Header.vue')
    const home = source('app/pages/index.vue')

    expect(header).toContain('aspectRatio="16 / 5"')
    expect(header).toContain(':width="128"')
    expect(header).not.toContain(':height="128"')
    expect(home).toContain('aspectRatio="1 / 1"')
    expect(home).toContain('containerClass="aspect-square w-full max-w-56 ')
    expect(home).not.toContain(':height="416"')
  })
})
