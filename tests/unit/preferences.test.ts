import { describe, expect, it } from 'vitest'

import { isPreferenceLanguage, isPreferenceTheme, preferenceCookieDomain } from '../../shared/utils/preferences'

describe('preference cookie isolation', () => {
  it.each(['topiqu.com', 'app.topiqu.com', 'blog.topiqu.com'])('shares preferences on %s', (host) => {
    expect(preferenceCookieDomain(host)).toBe('.topiqu.com')
  })
  it.each(['blog.example.com', 'topiqu.com.example.com', 'nottopiqu.com', 'localhost', '127.0.0.1'])(
    'keeps preferences host-only on %s',
    (host) => expect(preferenceCookieDomain(host)).toBeUndefined(),
  )
  it('accepts only supported locale and color choices from cookies', () => {
    for (const language of ['cs', 'en', 'de', 'fr']) expect(isPreferenceLanguage(language)).toBe(true)
    for (const invalid of [null, {}, 'en/../../admin', 'EN', 'es']) expect(isPreferenceLanguage(invalid)).toBe(false)
    for (const theme of ['light', 'dark']) expect(isPreferenceTheme(theme)).toBe(true)
    for (const invalid of [null, {}, 'system', 'dark; Domain=example.com'])
      expect(isPreferenceTheme(invalid)).toBe(false)
  })
})
