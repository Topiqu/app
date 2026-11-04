import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isDisposableEmail } from '../../server/utils/disposableEmails'
import { emailVerificationEmailSchema, signInSchema } from '../../shared/utils/auth'

afterEach(() => vi.unstubAllGlobals())

describe('disposable email protection', () => {
  it.each(['User@Mailinator.com', 'reader@inbox.mailinator.com', 'reader@temp-mail.org', 'reader@temp-mail.io'])(
    'rejects the disposable inbox %s',
    (email) => expect(isDisposableEmail(email)).toBe(true),
  )

  it.each(['reader@gmail.com', 'reader@company.example', 'reader@notmailinator.com', 'reader@mailinator.com.example'])(
    'allows the independent mailbox %s',
    (email) => expect(isDisposableEmail(email)).toBe(false),
  )

  it('rejects disposable registration before creating an account or sending mail', async () => {
    const save = vi.fn()
    const send = vi.fn()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('signInSchema', signInSchema)
    vi.stubGlobal('emailVerificationEmailSchema', emailVerificationEmailSchema)
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse({ username: 'reader', email: 'reader@inbox.mailinator.com', password: 'a-long-fixture-password' }),
    )
    vi.stubGlobal('isDisposableEmail', isDisposableEmail)
    vi.stubGlobal('saveUserWithLogging', save)
    vi.stubGlobal('issueEmailVerification', send)
    const handler = (await import('../../server/api/auth/register.post')).default
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      message: 'common.auth.disposableEmail',
    })
    expect(save).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
