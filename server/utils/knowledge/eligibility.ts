import type { ClientSiteWhereInput } from '~~/generated/zenstack/input'

import { AI_CAPABLE_PLANS } from '~~/shared/utils/plans'

import { activeFeatureFilter } from '../planFeatures'

/**
 * Standard plans retain requireAiPlan's legacy no-feature-row access, while an explicit AI
 * revocation takes effect. CUSTOM provisions features individually, so it needs an active grant.
 */
export const knowledgeSiteWhere = (): ClientSiteWhereInput => ({
  deletedAt: null,
  plan: { in: [...AI_CAPABLE_PLANS] },
  OR: [
    { plan: { not: 'CUSTOM' as const }, features: { none: { isActive: false, feature: { code: 'AI' } } } },
    activeFeatureFilter('AI'),
  ],
})
