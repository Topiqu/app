import type { AgencyQuantities } from '~~/shared/utils/agencyPlan'

import { isAgencyQuantities } from '~~/shared/utils/agencyPlan'

/** Set by the landing's agency page; lives until the person has an agency. */
export const AGENCY_INTENT_COOKIE = 'agency_intent'

export type AgencyIntent = Partial<AgencyQuantities>

/** `?intent=agency&blogs=…&premium=…&blocks=…`: the landing calculator's pick, kept only when it is a valid order. */
export const agencyIntentFromQuery = (query: Record<string, unknown>): AgencyIntent | null => {
  if (query.intent !== 'agency') return null
  const picked = { blogs: Number(query.blogs), premium: Number(query.premium ?? 0), blocks: Number(query.blocks) }
  return isAgencyQuantities(picked) ? picked : {}
}
