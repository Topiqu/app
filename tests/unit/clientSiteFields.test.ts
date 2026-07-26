import { describe, expect, it } from 'vitest'
import {
  PRIVILEGED_CLIENT_SITE_FIELDS,
  TENANT_EDITABLE_CLIENT_SITE_FIELDS,
  fieldMask,
} from '~~/shared/utils/clientSiteFields'

describe('client site field partition', () => {
  it('keeps revenue and entitlement fields out of tenant reach', () => {
    for (const field of ['plan', 'tokenLimit', 'gamNetworkCode', 'allowAds']) {
      expect(PRIVILEGED_CLIENT_SITE_FIELDS).toContain(field)
      expect(TENANT_EDITABLE_CLIENT_SITE_FIELDS).not.toContain(field)
    }
  })

  it('never lets a field sit in both sets', () => {
    const overlap = TENANT_EDITABLE_CLIENT_SITE_FIELDS.filter((field) =>
      (PRIVILEGED_CLIENT_SITE_FIELDS as readonly string[]).includes(field),
    )
    expect(overlap).toEqual([])
  })

  it('leaves presentation and content settings tenant-editable', () => {
    for (const field of ['name', 'theme', 'description', 'gtagId']) {
      expect(TENANT_EDITABLE_CLIENT_SITE_FIELDS).toContain(field)
    }
  })

  it('builds a zod pick mask from a field list', () => {
    expect(fieldMask(['plan', 'allowAds'] as const)).toEqual({ plan: true, allowAds: true })
  })

  it('produces disjoint masks', () => {
    const tenant = fieldMask(TENANT_EDITABLE_CLIENT_SITE_FIELDS)
    const privileged = fieldMask(PRIVILEGED_CLIENT_SITE_FIELDS)
    const shared = Object.keys(tenant).filter((key) => key in privileged)
    expect(shared).toEqual([])
  })
})
