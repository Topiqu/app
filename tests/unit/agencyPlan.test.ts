import { describe, expect, it } from 'vitest'

import { agencyIntentFromQuery } from '../../app/utils/agencyIntent'
import { AI_ALLOWANCES, AI_BUDGET_MICROS_PER_CENT } from '../../shared/utils/billingCatalog'
import {
  AGENCY_MAX_BLOCKS,
  AGENCY_MAX_BLOGS,
  AGENCY_MIN_BLOCKS,
  AGENCY_MIN_BLOGS,
  agencyAllowances,
  agencyPriceCents,
  agencyRolloverCap,
  agencySlotShortfall,
  agencyUnits,
  isAgencyLive,
  isAgencyQuantities,
} from '../../shared/utils/agencyPlan'

describe('agency plan', () => {
  it('prices blogs, PREMIUM add-ons and unit blocks separately', () => {
    expect(agencyPriceCents({ blogs: AGENCY_MIN_BLOGS, premium: 0, blocks: AGENCY_MIN_BLOCKS })).toBe(15_000)
    expect(agencyPriceCents({ blogs: 10, premium: 0, blocks: 8 })).toBe(34_000)
    // A PREMIUM blog with 100 credits stays under a direct PREMIUM plan ($99).
    expect(agencyPriceCents({ blogs: 1, premium: 1, blocks: 2 })).toBe(9_000)
    expect(agencyUnits(4)).toBe(200)
    expect(agencyRolloverCap(4)).toBe(400)
  })

  it('accepts only whole quantities inside the offer', () => {
    expect(isAgencyQuantities({ blogs: AGENCY_MIN_BLOGS, premium: 0, blocks: AGENCY_MIN_BLOCKS })).toBe(true)
    expect(isAgencyQuantities({ blogs: AGENCY_MAX_BLOGS, premium: AGENCY_MAX_BLOGS, blocks: AGENCY_MAX_BLOCKS })).toBe(
      true,
    )
    expect(isAgencyQuantities({ blogs: AGENCY_MIN_BLOGS - 1, premium: 0, blocks: AGENCY_MIN_BLOCKS })).toBe(false)
    expect(isAgencyQuantities({ blogs: AGENCY_MIN_BLOGS, premium: 0, blocks: AGENCY_MAX_BLOCKS + 1 })).toBe(false)
    expect(isAgencyQuantities({ blogs: 3.5, premium: 0, blocks: 4 })).toBe(false)
    // Every add-on sits on a blog slot.
    expect(isAgencyQuantities({ blogs: 3, premium: 4, blocks: 4 })).toBe(false)
    expect(isAgencyQuantities({ blogs: 3, premium: -1, blocks: 4 })).toBe(false)
  })

  it('never funds more AI than half of the list price', () => {
    for (const quantities of [
      { blogs: 3, premium: 0, blocks: 4 },
      { blogs: 50, premium: 0, blocks: 4 },
      { blogs: 3, premium: 3, blocks: 400 },
      { blogs: 500, premium: 500, blocks: 400 },
    ]) {
      const allowances = agencyAllowances(quantities)
      expect(allowances.BUDGET).toBe(agencyPriceCents(quantities) * AI_BUDGET_MICROS_PER_CENT)
      expect(allowances.BUDGET / 1_000_000).toBeLessThanOrEqual(agencyPriceCents(quantities) / 100 / 2)
    }
  })

  it('funds AI visibility and the daily keyword plan only for PREMIUM add-ons', () => {
    const pro = agencyAllowances({ blogs: 5, premium: 0, blocks: 4 })
    const premium = agencyAllowances({ blogs: 5, premium: 2, blocks: 4 })
    expect(pro.VISIBILITY).toBe(0)
    expect(premium.VISIBILITY).toBe(2 * AI_ALLOWANCES.PREMIUM.VISIBILITY)
    expect(premium.SEO - pro.SEO).toBe(2 * 5_000_000)
    expect(premium.TRANSLATION).toBeGreaterThan(pro.TRANSLATION)
    expect(premium.EDIT).toBe(pro.EDIT)
  })

  it('names the slot a set of blog plans lacks; a free blog takes none', () => {
    const slots = { blogSlots: 3, premiumSlots: 1 }
    expect(agencySlotShortfall(slots, ['PRO', 'PREMIUM', 'PRO', 'BASIC', 'BASIC'])).toBeNull()
    expect(agencySlotShortfall(slots, ['PRO', 'PRO', 'PRO', 'PRO'])).toBe('NO_FREE_SLOT')
    expect(agencySlotShortfall(slots, ['PREMIUM', 'PREMIUM'])).toBe('NO_FREE_PREMIUM_SLOT')
    // A blog slot is checked first: a PREMIUM blog needs both.
    expect(agencySlotShortfall(slots, ['PRO', 'PRO', 'PRO', 'PREMIUM'])).toBe('NO_FREE_SLOT')
  })

  it('keeps blogs live through dunning only', () => {
    expect(['ACTIVE', 'PAST_DUE', 'INACTIVE', 'CANCELED'].filter(isAgencyLive)).toEqual(['ACTIVE', 'PAST_DUE'])
  })
})

describe('agency intent from the landing', () => {
  it('keeps a valid calculator pick and drops an invalid one but not the intent', () => {
    expect(agencyIntentFromQuery({ intent: 'agency', blogs: '5', premium: '1', blocks: '6' })).toEqual({
      blogs: 5,
      premium: 1,
      blocks: 6,
    })
    expect(agencyIntentFromQuery({ intent: 'agency', blogs: '2', blocks: '4' })).toEqual({})
    expect(agencyIntentFromQuery({ intent: 'agency', blogs: '5', premium: '9', blocks: '4' })).toEqual({})
    expect(agencyIntentFromQuery({ intent: 'agency' })).toEqual({})
    expect(agencyIntentFromQuery({ blogs: '5', blocks: '6' })).toBeNull()
  })
})
