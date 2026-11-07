import type { WebsiteImportView } from './websiteImport'

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
  /** Any article, a draft from a writer's own editor or a finished AI generation. */
  hasDraft?: boolean
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
  websiteImport?: Pick<WebsiteImportView, 'status'> | null
}

export type SetupChecklistStepId =
  SetupStepId | 'website' | 'draft' | 'author' | 'knowledge' | 'publishing' | OptionalSetupStepId
export type SetupRequirementId =
  | 'website'
  | 'draft'
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

/** `start` leads to the first published article; `later` is the fine-tuning nothing waits on. */
export type SetupPhase = 'start' | 'later'

export interface SetupChecklistStep {
  id: SetupChecklistStepId
  phase: SetupPhase
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
  const ai = hasAiPlan(site.plan)
  const step = (
    id: SetupChecklistStepId,
    phase: SetupPhase,
    requirements: SetupChecklistStep['requirements'],
  ): SetupChecklistStep => {
    const done = requirements.every((requirement) => requirement.done)
    return { id, phase, requirements, done, state: done ? 'done' : 'todo' }
  }
  const optional = (id: OptionalSetupStepId, requirement: SetupChecklistStep['requirements'][number]) => {
    const item = step(id, 'later', [requirement])
    return { ...item, optional: true, skipped: !item.done && !!choices?.skipped.includes(id) }
  }
  const branding = step('branding', ai ? 'later' : 'start', [
    { id: 'name', done: filled(site.name) },
    { id: 'logo', done: filled(site.logoUrl) },
    { id: 'description', done: filled(site.description) },
  ])
  const steps: SetupChecklistStep[] = []

  if (ai) {
    // A skipped review still finishes the step: generation never needs the brief, it only reads better with it.
    const website = step('website', 'start', [
      {
        id: 'website',
        done: site.websiteImport?.status === 'REVIEWED' || (filled(site.focus) && filled(site.audience)),
      },
    ])
    if (!website.done) {
      if (site.websiteImport?.status === 'PENDING' || site.websiteImport?.status === 'PROCESSING')
        website.state = 'processing'
      else if (site.websiteImport?.status === 'FAILED') website.state = 'attention'
    }
    steps.push(
      website,
      step('draft', 'start', [
        { id: 'draft', done: site.setup?.hasDraft === true || site.setup?.hasPublishedArticle === true },
      ]),
    )
  } else steps.push(branding)
  steps.push(step('article', 'start', [{ id: 'article', done: site.setup?.hasPublishedArticle === true }]))

  if (ai) {
    const knowledge = step('knowledge', 'later', [{ id: 'source', done: (site.setup?.knowledge.indexed ?? 0) > 0 }])
    if (!knowledge.done) {
      if (site.setup?.knowledge.processing) knowledge.state = 'processing'
      else if (site.setup?.knowledge.failed) knowledge.state = 'attention'
    }
    const publishing = site.setup?.publishing
    steps.push(
      branding,
      step('author', 'later', [
        { id: 'authorName', done: filled(site.aiUser?.username) },
        { id: 'avatar', done: filled(site.aiUser?.avatarUrl) },
        { id: 'bio', done: filled(site.aiUser?.bio) },
        { id: 'tone', done: filled(site.aiToneOfVoice) },
      ]),
      step('voice', 'later', [
        { id: 'focus', done: filled(site.focus) },
        { id: 'audience', done: filled(site.audience) },
      ]),
      knowledge,
      step('publishing', 'later', [
        { id: 'publishingMode', done: !!publishing && (!!publishing.scheduled || !!choices?.publishingReviewed) },
        ...(publishing?.scheduled ? [{ id: 'schedule' as const, done: publishing.scheduleValid }] : []),
      ]),
    )
  }

  const domain = site.pendingDomain || site.domain
  if (domain && !isManagedDomain(domain, baseDomain)) {
    steps.push(step('domain', 'later', [{ id: 'domain', done: !site.pendingDomain && site.domainVerified === true }]))
  }
  if (ai) {
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
  if (ai) {
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
