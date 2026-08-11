export interface EmptySiteInfo {
  name?: string | null
  logoUrl?: string | null
  description?: string | null
  tagline?: string | null
  focus?: string | null
  audience?: string | null
  plan?: string | null
  domainVerified?: boolean | null
}

export type EmptySetupStepId = 'article' | 'branding' | 'voice' | 'domain'

export interface EmptySetupStep {
  id: EmptySetupStepId
  done: boolean
  locked: boolean
}

export const AI_CAPABLE_PLANS = ['PRO', 'PREMIUM', 'CUSTOM'] as const

export const buildEmptySetupSteps = (site?: EmptySiteInfo | null): EmptySetupStep[] => {
  const hasAiPlan = (AI_CAPABLE_PLANS as readonly string[]).includes(site?.plan ?? '')

  return [
    { id: 'article', done: false, locked: false },
    { id: 'branding', done: Boolean(site?.logoUrl && site?.description), locked: false },
    { id: 'voice', done: hasAiPlan && Boolean(site?.focus && site?.audience), locked: !hasAiPlan },
    { id: 'domain', done: Boolean(site?.domainVerified), locked: false },
  ]
}

export const emptySetupProgress = (steps: EmptySetupStep[]) => {
  const actionable = steps.filter((step) => !step.locked)
  const done = actionable.filter((step) => step.done).length
  const total = actionable.length

  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
