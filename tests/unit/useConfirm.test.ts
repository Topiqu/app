import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import { useConfirm } from '../../app/composables/useConfirm'
import AppConfirmDialog from '../../app/components/AppConfirmDialog.vue'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  create: vi.fn(() => ({ open: (...args: unknown[]) => mocks.open(...args) })),
}))

mockNuxtImport('useOverlay', () => () => ({ create: mocks.create }))

describe('useConfirm', () => {
  it.each([true, false, undefined])('resolves the overlay result (%s)', async (result) => {
    mocks.open.mockResolvedValueOnce(result)
    mocks.create.mockClear()

    const confirm = useConfirm()
    await expect(confirm({ title: 'Confirm' })).resolves.toBe(result === true)
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(AppConfirmDialog, { destroyOnClose: true })
    expect(mocks.open).toHaveBeenCalledWith({ title: 'Confirm' })
  })
})
