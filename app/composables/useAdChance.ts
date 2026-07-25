import type { ClientPlan } from '@prisma/client'

export interface AdTargeting {
  client_id: string
  plan: ClientPlan
}

export const useAdChance = () => {
  const adTargeting = useState<AdTargeting | null>('ad-targeting', () => null)

  const assign = (clientId: string, plan: ClientPlan): AdTargeting => {
    const result: AdTargeting = { client_id: clientId, plan }
    adTargeting.value = result
    return result
  }

  return { adTargeting, assign }
}
