export type ArticleBatchPauseReason = 'credits' | 'allowance' | 'access' | 'failures'

export interface ArticleBatchProposalRow {
  id: string
  topic: string
  reason: string | null
  keyword: string | null
  volume: number | null
  recommended: boolean
}

export interface ArticleBatchItemView {
  id: string
  topic: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  scheduledFor: string
  article: {
    slug: string
    title: string
    status: string
    releaseAt: string | null
    held: boolean
  } | null
}

export interface ArticleBatchView {
  id: string
  status: 'PROPOSED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED'
  mode: 'SPREAD' | 'DRAFTS' | null
  paceHours: number | null
  proposal: ArticleBatchProposalRow[]
  proposing: boolean
  pauseReason: ArticleBatchPauseReason | null
  pausedUntil: string | null
  items: ArticleBatchItemView[]
}

export interface ArticleBatchOverview {
  clientSiteId: string
  enabled: boolean
  /** The site has a focus or keywords to propose topics from. */
  hasProfile: boolean
  /** ARTICLE_CRONS is active, so the autopilot levers can do anything. */
  autopilot: boolean
  autoRelease: boolean
  publishToWeb: boolean
  quality: 'STANDARD' | 'HIGH' | 'ULTRA'
  credits: {
    available: number
    cost: number
    monthlyAllowance: number
    autopilotPerMonth: number
    autopilotCredits: number
    monthlySurplus: number
    free: number
    atRolloverCap: boolean
  }
  recommended: {
    quality: 'HIGH' | 'ULTRA' | 'STANDARD' | null
    interval: { intervalMinHours: number; intervalMaxHours: number; perMonth: number } | null
  }
  batch: ArticleBatchView | null
}
