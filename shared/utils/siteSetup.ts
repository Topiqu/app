import { hasAiPlan } from './plans'
import { isManagedDomain } from './domain'

export interface SiteSetupInfo {
  name?: string | null
  logoUrl?: string | null
  description?: string | null
  tagline?: string | null
  focus?: string | null
  audience?: string | null
  plan?: string | null
  domain?: string | null
  domainVerified?: boolean | null
}

export type SetupStepId = 'branding' | 'voice' | 'domain'

export interface SetupStep {
  id: SetupStepId
  done: boolean
}

/** Only what the tenant can act on: no upsell rows, and a domain row only for an unverified custom domain. */
export const buildSetupSteps = (site?: SiteSetupInfo | null, baseDomain?: string): SetupStep[] => {
  const steps: SetupStep[] = [{ id: 'branding', done: Boolean(site?.logoUrl && site?.description) }]
  if (hasAiPlan(site?.plan)) steps.push({ id: 'voice', done: Boolean(site?.focus && site?.audience) })
  if (site?.domain && !site.domainVerified && !isManagedDomain(site.domain, baseDomain))
    steps.push({ id: 'domain', done: false })
  return steps
}

export const setupProgress = (steps: SetupStep[]) => {
  const done = steps.filter((step) => step.done).length
  const total = steps.length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
