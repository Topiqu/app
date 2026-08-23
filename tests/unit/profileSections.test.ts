import { describe, expect, it } from 'vitest'

import { sectionId, tabForSection, toHandle } from '../../app/utils/profileSections'

describe('profileSections', () => {
  it('strips a leading hash so route hashes and raw ids resolve alike', () => {
    expect(sectionId('#2fa-section')).toBe('2fa-section')
    expect(sectionId('2fa-section')).toBe('2fa-section')
  })

  // Every account-health check links to one of these; landing on the wrong tab hides the control.
  it.each([
    ['email-section', 'security'],
    ['password-section', 'security'],
    ['2fa-section', 'security'],
    ['sessions-section', 'security'],
    ['events-section', 'security'],
    ['username-section', 'profile'],
    ['bio-section', 'profile'],
    ['language-section', 'profile'],
    ['id-section', 'profile'],
    ['registration-section', 'profile'],
    ['notifications-section', 'notifications'],
  ])('resolves %s to the %s tab', (section, tab) => {
    expect(tabForSection(section)).toBe(tab)
    expect(tabForSection(`#${section}`)).toBe(tab)
  })

  it('returns undefined for an unknown section so the current tab stays put', () => {
    expect(tabForSection('#nope')).toBeUndefined()
  })

  it('builds a handle by lowercasing and dropping whitespace', () => {
    expect(toHandle('Vojta Ben')).toBe('vojtaben')
    expect(toHandle('  Multi   Space  ')).toBe('multispace')
  })

  it('falls back to an empty handle when there is no username yet', () => {
    expect(toHandle(undefined)).toBe('')
    expect(toHandle(null)).toBe('')
  })
})
