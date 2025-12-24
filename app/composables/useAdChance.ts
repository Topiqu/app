import type { ClientPlan } from '@prisma/client'
interface AdTargeting {
  client_id: string
  revenue_owner: 'client' | 'platform'
  plan: ClientPlan
}

export const useAdChance = () => {
  const adTargeting = ref<AdTargeting | null>(null)
  if (import.meta.server) return null

  const calculateAdTargeting = (clientId: string, plan: ClientPlan): AdTargeting => {
    const random = Math.random()
    let owner: AdTargeting['revenue_owner'] = 'platform'
    switch (plan) {
      case 'BASIC':
        owner = 'platform'
        break
      case 'PRO':
        owner = random < 0.7 ? 'client' : 'platform'
        break
      case 'PREMIUM':
        owner = random < 0.9 ? 'client' : 'platform'
        break
      case 'CUSTOM':
        owner = 'client'
        break
    }
    return { client_id: clientId, revenue_owner: owner, plan }
  }

  const assign = (clientId: string, plan: ClientPlan) => {
    const result = calculateAdTargeting(clientId, plan)
    adTargeting.value = result
    return result
  }

  return { adTargeting, assign, calculateAdTargeting }
}
