// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearNuxtState, useState } from '#app'

import { useAuth } from '../../app/composables/useAuth'

const request = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => request)
beforeEach(() => {
  clearNuxtState('auth')
  request.mockReset()
  useState('auth').value = { user: { id: 'viewer' }, session: { id: 'session-one' } }
})

describe('session recovery', () => {
  it('preserves an established session on transient failures', async () => {
    request.mockRejectedValue(new Error('Offline'))
    const auth = useAuth()
    await expect(auth.getSession()).resolves.toMatchObject({ user: { id: 'viewer' } })
    await expect(auth.getSession({ throwOnError: true })).rejects.toThrow('Offline')
    expect(auth.data.value?.user.id).toBe('viewer')
  })

  it('clears a session only when the server confirms expiry', async () => {
    request.mockResolvedValue(null)
    const auth = useAuth()
    await auth.getSession({ throwOnError: true })
    expect(auth.data.value).toBeNull()
  })

  it('handles a confirmed 401 as signed out', async () => {
    request.mockRejectedValue({ statusCode: 401 })
    const auth = useAuth()
    await auth.getSession({ throwOnError: true })
    expect(auth.data.value).toBeNull()
  })

  it('ignores a stale 401 after a newer session has been established', async () => {
    let reject!: (error: unknown) => void
    request.mockReturnValueOnce(
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest
      }),
    )
    const auth = useAuth()
    const stale = auth.getSession({ throwOnError: true })
    request.mockResolvedValueOnce({ user: { id: 'other-viewer' }, session: { id: 'new-session' } })
    await auth.getSession()
    reject({ statusCode: 401 })
    await stale
    expect(auth.data.value?.user.id).toBe('other-viewer')
  })
})
