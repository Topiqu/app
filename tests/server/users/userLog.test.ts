import { afterEach, describe, expect, it, vi } from 'vitest'

import { saveUserWithLogging } from '../../../server/utils/userLog'

const setup = () => {
  const user = {
    id: 'viewer',
    username: 'Fixture',
    email: 'fixture@example.invalid',
    role: 'reader',
    clientSiteId: 'site',
  }
  const create = vi.fn(async () => user)
  const update = vi.fn(async () => user)
  const log = vi.fn(async (_entry: { action: string; metadata: Record<string, unknown> }) => {})
  vi.stubGlobal('getIp', () => '127.0.0.1')
  vi.stubGlobal('getSessionUser', async () => ({ id: 'viewer' }))
  vi.stubGlobal('getEnhancedPrisma', async () => ({ user: { create, update } }))
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('invalidateAuthor', vi.fn())
  return { create, update, log }
}
afterEach(() => vi.unstubAllGlobals())

describe('password strength audit with factory API', () => {
  it('records a score without retaining the password in audit metadata', async () => {
    const state = setup()
    const password = 'L7!n2Q$w9vR#4tY@8uZ%'
    await saveUserWithLogging({} as never, { username: 'Fixture', password })
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ data: { username: 'Fixture', password } }))
    expect(state.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_SET', metadata: { passwordStrength: expect.any(Number) } }),
    )
    const strength = state.log.mock.calls.find(([entry]) => entry.action === 'PASSWORD_SET')?.[0].metadata
      .passwordStrength
    expect(strength).toBeGreaterThanOrEqual(3)
    expect(JSON.stringify(state.log.mock.calls)).not.toContain(password)
  })

  it('does not reuse a previous password’s result when updating or omitting a password', async () => {
    const state = setup()
    await saveUserWithLogging({} as never, { password: 'aaaa' })
    expect(state.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_SET', metadata: { passwordStrength: 0 } }),
    )
    state.log.mockClear()
    await saveUserWithLogging({} as never, { id: 'viewer', password: 'L7!n2Q$w9vR#4tY@8uZ%' }, true)
    expect(state.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_CHANGE', metadata: { passwordStrength: expect.any(Number) } }),
    )
    state.log.mockClear()
    await saveUserWithLogging({} as never, { id: 'viewer' }, true)
    expect(state.update).toHaveBeenCalledTimes(2)
    expect(state.log).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ action: 'USER_UPDATE' }))
  })
})
