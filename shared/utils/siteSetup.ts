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
  hasPublishedArticle?: boolean
}

export type SetupStepId = 'branding' | 'voice' | 'domain' | 'article'

export interface SetupStep {
  id: SetupStepId
  done: boolean
}

/** Recommendations such as logos and knowledge imports do not count toward the first publication. */
export const buildSetupSteps = (site?: SiteSetupInfo | null, baseDomain?: string): SetupStep[] => {
  const steps: SetupStep[] = [{ id: 'branding', done: Boolean(site?.description?.trim()) }]
  if (hasAiPlan(site?.plan)) steps.push({ id: 'voice', done: Boolean(site?.focus?.trim() && site?.audience?.trim()) })
  if (site?.domain && !site.domainVerified && !isManagedDomain(site.domain, baseDomain))
    steps.push({ id: 'domain', done: false })
  steps.push({ id: 'article', done: site?.hasPublishedArticle === true })
  return steps
}

export const setupProgress = (steps: SetupStep[]) => {
  const done = steps.filter((step) => step.done).length
  const total = steps.length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
