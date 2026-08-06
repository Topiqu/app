import { describe, expect, it } from 'vitest'

import { models } from '../../../shared/zod'
import {
  PRIVILEGED_CLIENT_SITE_FIELDS,
  TENANT_EDITABLE_CLIENT_SITE_FIELDS,
  fieldMask,
  pickFields,
} from '../../../shared/utils/clientSiteFields'

const TenantSchema = models.ClientSiteScalarSchema.pick(fieldMask(TENANT_EDITABLE_CLIENT_SITE_FIELDS)).partial()
const PrivilegedSchema = models.ClientSiteScalarSchema.pick(fieldMask(PRIVILEGED_CLIENT_SITE_FIELDS)).partial()

const settingsPayload = () => ({
  focus: 'AI a automatizace',
  audience: 'Čeští freelanceři',
  language: 'cs',
  theme: 'pink',
  keywords: ['AI'],
  description: 'Testovací magazín',
  logoUrl: '',
  socials: [],
  aiToneOfVoice: 'Přímý a věcný',
  aiControversyLevel: 'MEDIUM',
  gtagId: '',
  allowGtag: false,
  autoRelease: false,
  translationMode: 'HYBRID',
  translationLanguages: ['en'],
  gamNetworkCode: '123456',
  allowAds: true,
})

describe('client site PATCH field masks', () => {
  it('accepts a settings payload that mixes tenant and privileged fields', () => {
    const body = settingsPayload()

    expect(TenantSchema.safeParse(pickFields(body, TENANT_EDITABLE_CLIENT_SITE_FIELDS)).success).toBe(true)
    expect(PrivilegedSchema.safeParse(pickFields(body, PRIVILEGED_CLIENT_SITE_FIELDS)).success).toBe(true)
  })

  it('keeps privileged fields out of the tenant slice', () => {
    const tenantSlice = pickFields(settingsPayload(), TENANT_EDITABLE_CLIENT_SITE_FIELDS)

    for (const field of PRIVILEGED_CLIENT_SITE_FIELDS) expect(tenantSlice).not.toHaveProperty(field)
  })

  it('drops keys the caller never sent so untouched columns are not overwritten', () => {
    const slice = pickFields({ focus: 'AI', audience: undefined }, TENANT_EDITABLE_CLIENT_SITE_FIELDS)

    expect(slice).toEqual({ focus: 'AI' })
  })

  it('ignores unknown and relational keys entirely', () => {
    const slice = pickFields(
      { focus: 'AI', socials: [], aiUser: {}, deletedAt: null, tokenRemaining: 999_999 },
      TENANT_EDITABLE_CLIENT_SITE_FIELDS,
    )

    expect(slice).toEqual({ focus: 'AI' })
  })
})
