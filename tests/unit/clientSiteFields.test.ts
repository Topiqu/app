import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  CLIENT_SITE_SECRET_FIELDS,
  PRIVILEGED_CLIENT_SITE_FIELDS,
  PUBLIC_CLIENT_SITE_FIELDS,
  TENANT_EDITABLE_CLIENT_SITE_FIELDS,
  fieldMask,
  publicClientSiteSelect,
} from '~~/shared/utils/clientSiteFields'

describe('client site field partition', () => {
  it('keeps revenue and entitlement fields out of tenant reach', () => {
    for (const field of ['plan', 'tokenLimit']) {
      expect(PRIVILEGED_CLIENT_SITE_FIELDS).toContain(field)
      expect(TENANT_EDITABLE_CLIENT_SITE_FIELDS).not.toContain(field)
    }
    expect(TENANT_EDITABLE_CLIENT_SITE_FIELDS).toContain('gamNetworkCode')
    expect(PRIVILEGED_CLIENT_SITE_FIELDS).not.toContain('gamNetworkCode')
  })

  it('never lets a field sit in both sets', () => {
    const overlap = TENANT_EDITABLE_CLIENT_SITE_FIELDS.filter((field) =>
      (PRIVILEGED_CLIENT_SITE_FIELDS as readonly string[]).includes(field),
    )
    expect(overlap).toEqual([])
  })

  it('leaves presentation and content settings tenant-editable', () => {
    for (const field of ['name', 'theme', 'description', 'tagline', 'faviconUrl', 'typographyPreset', 'gtagId']) {
      expect(TENANT_EDITABLE_CLIENT_SITE_FIELDS).toContain(field)
    }
  })

  it('builds a zod pick mask from a field list', () => {
    expect(fieldMask(['plan', 'tokenLimit'] as const)).toEqual({ plan: true, tokenLimit: true })
  })

  it('produces disjoint masks', () => {
    const tenant = fieldMask(TENANT_EDITABLE_CLIENT_SITE_FIELDS)
    const privileged = fieldMask(PRIVILEGED_CLIENT_SITE_FIELDS)
    const shared = Object.keys(tenant).filter((key) => key in privileged)
    expect(shared).toEqual([])
  })
})

describe('public client site read projection', () => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'ClientSite')!
  const scalars = model.fields.filter((f) => f.kind !== 'object').map((f) => f.name)

  it('publishes the complete brand kit', () => {
    for (const field of ['tagline', 'faviconUrl', 'typographyPreset']) {
      expect(PUBLIC_CLIENT_SITE_FIELDS).toContain(field)
      expect(publicClientSiteSelect).toHaveProperty(field, true)
    }
  })

  it('never exposes credentials, billing identifiers or quota internals', () => {
    for (const field of [
      'apiKey',
      'stripeCustomerId',
      'stripeSubscriptionId',
      'stripePriceId',
      'tokenLimit',
      'tokenRemaining',
      'totalUsage',
      'monthlyPayment',
      'annualPayment',
      'communityInsight',
    ]) {
      expect(CLIENT_SITE_SECRET_FIELDS).toContain(field)
      expect(PUBLIC_CLIENT_SITE_FIELDS).not.toContain(field)
      expect(publicClientSiteSelect).not.toHaveProperty(field)
    }
  })

  it('keeps the public and non-public sets disjoint', () => {
    const overlap = PUBLIC_CLIENT_SITE_FIELDS.filter((field) =>
      (CLIENT_SITE_SECRET_FIELDS as readonly string[]).includes(field),
    )
    expect(overlap).toEqual([])
  })

  it('only lists fields that actually exist on the model', () => {
    for (const field of [...PUBLIC_CLIENT_SITE_FIELDS, ...CLIENT_SITE_SECRET_FIELDS]) {
      expect(scalars).toContain(field)
    }
  })

  it('is a whitelist, so a newly added model field stays private until listed', () => {
    const classified = new Set<string>([...PUBLIC_CLIENT_SITE_FIELDS, ...CLIENT_SITE_SECRET_FIELDS])
    const unclassified = scalars.filter((field) => !classified.has(field))

    // Relations are opt-in by name and each one is its own projection, so they are listed here
    // rather than in the scalar whitelist.
    const RELATIONS = ['socials']

    expect(Object.keys(publicClientSiteSelect)).toEqual([...PUBLIC_CLIENT_SITE_FIELDS, ...RELATIONS])
    for (const field of unclassified) {
      expect(publicClientSiteSelect).not.toHaveProperty(field)
    }
  })
})
