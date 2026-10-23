import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { reportCaughtError } from '../../server/utils/reportError'

const capture = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nuxt', () => ({ captureException: capture }))

beforeEach(() => {
  capture.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('still reports to the logger when the exception transport fails', async () => {
  capture.mockImplementation(() => {
    throw new Error('Transport unavailable')
  })
  const error = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('logger', { error })
  await expect(
    reportCaughtError('Delivery failed', new Error('Mail unavailable'), { commentId: 'c1' }),
  ).resolves.toBeUndefined()
  expect(error).toHaveBeenCalledOnce()
})

it('keeps a handled mutation successful when the logger transport fails', async () => {
  vi.stubGlobal('logger', { error: vi.fn().mockRejectedValue(new Error('Transport unavailable')) })
  const fallback = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(reportCaughtError('Delivery failed', new Error('Mail unavailable'))).resolves.toBeUndefined()
  expect(capture).toHaveBeenCalledOnce()
  expect(fallback).toHaveBeenCalledOnce()
})
