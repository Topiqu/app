import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import csCommon from '../../i18n/locales/cs/common.json'
import enCommon from '../../i18n/locales/en/common.json'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const MESSAGE_KEYS = [
  'rejected',
  'notImage',
  'formatNotAllowed',
  'notSquare',
  'faviconSquare',
  'faviconDimensions',
  'tooLarge',
  'tooSmall',
  'dimensionsTooLarge',
  'dimensionsTooSmall',
  'unreadable',
]

describe('upload rejections', () => {
  it('names every rejection in both locales', () => {
    for (const key of MESSAGE_KEYS) {
      expect((enCommon.common.upload as Record<string, string>)[key], `en ${key}`).toBeTruthy()
      expect((csCommon.common.upload as Record<string, string>)[key], `cs ${key}`).toBeTruthy()
    }
  })

  it('tells the user why the file was refused instead of a generic failure', () => {
    const uploader = source('app/components/File/Uploader.vue')

    expect(uploader).not.toContain('operationFailed')
    expect(uploader).not.toContain('Příliš velký')
    expect(uploader).not.toContain('Rozměry příliš')
    expect(uploader).toContain("title: $t('common.upload.rejected')")
    expect(uploader).toContain('description: reason')
    // A file the browser cannot decode used to leave the promise pending, so nothing was ever reported.
    expect(uploader).toContain('image.onerror = () => resolve(null)')
  })

  it('translates every server-side favicon rejection', () => {
    const handler = source('server/api/upload.ts')

    for (const reason of ['type', 'bytes', 'unreadable', 'square', 'dimensions'])
      expect(handler, reason).toContain(`${reason}: t('common.upload.`)
    expect(handler).not.toContain("statusMessage: 'Favicon")
    expect(handler).not.toContain("statusMessage: 'File")
  })
})
