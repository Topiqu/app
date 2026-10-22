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

export interface SiteSetupStatus {
  hasPublishedArticle: boolean
  draftArticleSlug?: string | null
  knowledge: { indexed: number; processing: number; failed: number }
  publishing?: { automatic: boolean; scheduled: boolean; scheduleValid: boolean }
  measurement?: { analytics: boolean; searchConsole: boolean }
  team?: { members: number; invitations: number }
  channels?: { shopify: boolean; linkedin: boolean }
}

export const OPTIONAL_SETUP_STEPS = ['measurement', 'team', 'channels'] as const
export type OptionalSetupStepId = (typeof OPTIONAL_SETUP_STEPS)[number]
export interface SetupChecklistChoices {
  publishingReviewed: boolean
  skipped: OptionalSetupStepId[]
}

export interface SiteSetupChecklistInfo extends SiteSetupInfo {
  pendingDomain?: string | null
  aiToneOfVoice?: string | null
  aiUser?: { username?: string | null; bio?: string | null; avatarUrl?: string | null } | null
  setup?: SiteSetupStatus
}

export type SetupChecklistStepId = SetupStepId | 'author' | 'knowledge' | 'publishing' | OptionalSetupStepId
export type SetupRequirementId =
  | 'name'
  | 'logo'
  | 'description'
  | 'authorName'
  | 'avatar'
  | 'bio'
  | 'tone'
  | 'focus'
  | 'audience'
  | 'source'
  | 'domain'
  | 'article'
  | 'publishingMode'
  | 'schedule'
  | 'measurement'
  | 'teammate'
  | 'channel'

export interface SetupChecklistStep {
  id: SetupChecklistStepId
  done: boolean
  state: 'todo' | 'done' | 'processing' | 'attention'
  requirements: { id: SetupRequirementId; done: boolean }[]
  optional?: boolean
  skipped?: boolean
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

export const buildSetupChecklist = (
  site?: SiteSetupChecklistInfo | null,
  baseDomain?: string,
  choices?: SetupChecklistChoices,
): SetupChecklistStep[] => {
  if (!site) return []
  const filled = (value?: string | null) => Boolean(value?.trim())
  const step = (id: SetupChecklistStepId, requirements: SetupChecklistStep['requirements']): SetupChecklistStep => {
    const done = requirements.every((requirement) => requirement.done)
    return { id, requirements, done, state: done ? 'done' : 'todo' }
  }
  const steps = [
    step('branding', [
      { id: 'name', done: filled(site.name) },
      { id: 'logo', done: filled(site.logoUrl) },
      { id: 'description', done: filled(site.description) },
    ]),
  ]

  if (hasAiPlan(site.plan)) {
    steps.push(
      step('author', [
        { id: 'authorName', done: filled(site.aiUser?.username) },
        { id: 'avatar', done: filled(site.aiUser?.avatarUrl) },
        { id: 'bio', done: filled(site.aiUser?.bio) },
        { id: 'tone', done: filled(site.aiToneOfVoice) },
      ]),
    )
    steps.push(
      step('voice', [
        { id: 'focus', done: filled(site.focus) },
        { id: 'audience', done: filled(site.audience) },
      ]),
    )
    const knowledge = step('knowledge', [{ id: 'source', done: (site.setup?.knowledge.indexed ?? 0) > 0 }])
    if (!knowledge.done) {
      if (site.setup?.knowledge.processing) knowledge.state = 'processing'
      else if (site.setup?.knowledge.failed) knowledge.state = 'attention'
    }
    steps.push(knowledge)
    const publishing = site.setup?.publishing
    steps.push(
      step('publishing', [
        { id: 'publishingMode', done: !!publishing && (!!publishing.scheduled || !!choices?.publishingReviewed) },
        ...(publishing?.scheduled ? [{ id: 'schedule' as const, done: publishing.scheduleValid }] : []),
      ]),
    )
  }

  const domain = site.pendingDomain || site.domain
  if (domain && !isManagedDomain(domain, baseDomain)) {
    steps.push(step('domain', [{ id: 'domain', done: !site.pendingDomain && site.domainVerified === true }]))
  }
  steps.push(step('article', [{ id: 'article', done: site.setup?.hasPublishedArticle === true }]))
  const optional = (id: OptionalSetupStepId, requirement: SetupChecklistStep['requirements'][number]) => {
    const item = step(id, [requirement])
    return { ...item, optional: true, skipped: !item.done && !!choices?.skipped.includes(id) }
  }
  if (hasAiPlan(site.plan)) {
    steps.push(
      optional('measurement', {
        id: 'measurement',
        done: !!(site.setup?.measurement?.analytics || site.setup?.measurement?.searchConsole),
      }),
    )
  }
  steps.push(
    optional('team', {
      id: 'teammate',
      done: (site.setup?.team?.members ?? 0) > 1 || (site.setup?.team?.invitations ?? 0) > 0,
    }),
  )
  if (hasAiPlan(site.plan)) {
    steps.push(
      optional('channels', {
        id: 'channel',
        done: !!(site.setup?.channels?.shopify || site.setup?.channels?.linkedin),
      }),
    )
  }
  return steps
}

export const setupProgress = (steps: (Pick<SetupStep, 'done'> & { skipped?: boolean })[]) => {
  const done = steps.filter((step) => step.done || step.skipped).length
  const total = steps.length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
