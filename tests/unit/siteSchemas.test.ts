import { describe, expect, it } from 'vitest'

import { schema } from '../../generated/zenstack/schema'
import { LANGUAGE_OPTIONS, THEME_OPTIONS } from '../../shared/siteSchemas'

describe('site schemas', () => {
  it('keeps browser-safe option lists synchronized with ZModel enums', () => {
    expect(LANGUAGE_OPTIONS.toSorted()).toEqual(Object.values(schema.enums.Language.values).toSorted())
    expect(THEME_OPTIONS.toSorted()).toEqual(Object.values(schema.enums.Theme.values).toSorted())
  })
})
