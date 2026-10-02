// @vitest-environment nuxt
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const { add } = vi.hoisted(() => ({ add: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('useDiscardChanges', () => {
  it('offers the discarded edits back from the toast', () => {
    const restore = vi.fn()
    useDiscardChanges()(restore)

    const toast = add.mock.calls[0]![0]
    expect(toast.title).toBe('common.messages.changesDiscarded')
    expect(toast.actions).toHaveLength(1)
    toast.actions[0].onClick()
    expect(restore).toHaveBeenCalledOnce()
  })

  // Discarding is reversible, so neither page asks first.
  it('discards without a confirm dialog and keeps a copy for undo', () => {
    const settings = source('app/pages/settings/index.vue')
    const reset = settings.slice(settings.indexOf('const resetForm'), settings.indexOf('const generateApiKey'))
    expect(reset).not.toContain('confirm(')
    expect(reset).toContain('discardChanges(() => (form.value = edited))')

    const profile = source('app/pages/uzivatel/index.vue')
    expect(profile).toContain('discardChanges(() => Object.assign(profileForm, edited))')
    expect(source('app/components/UnsavedBar.vue')).toContain("$t('common.actions.discardChanges')")
  })
})
