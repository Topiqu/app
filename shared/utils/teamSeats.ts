import type { ClientPlan } from '../../generated/zenstack/models'

/** Null CUSTOM capacity is reserved for existing individually contracted blogs. */
export const teamSeatLimit = (plan: ClientPlan, paidTeamSeats: number | null = null): number | null =>
  plan === 'CUSTOM' ? paidTeamSeats : { BASIC: 1, PRO: 2, PREMIUM: 3 }[plan]
