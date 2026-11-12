import type { AgencyBlogPlan } from '~~/shared/utils/agencyPlan'

export type AgencyRole = 'OWNER' | 'MEMBER'
export type AgencyStatus = 'INACTIVE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

export interface AgencyCatalog {
  blogCents: number
  premiumCents: number
  blockCents: number
  blockUnits: number
  minBlogs: number
  maxBlogs: number
  minBlocks: number
  maxBlocks: number
}

export interface AgencyAccount {
  id: string
  name: string | null
  status: AgencyStatus
  blogSlots: number
  premiumSlots: number
  unitBlocks: number
  firstPaidAt: string | null
  paidThrough: string | null
  hasBillingPortal: boolean
}

export interface AgencyBlog {
  id: string
  name: string
  domain: string
  deleted: boolean
  plan: AgencyBlogPlan
  monthlyUnitLimit: number | null
  unitsUsed: number
  published: number
}

export interface AgencyAttachableBlog {
  id: string
  name: string
  domain: string
  blocked: 'SHOPIFY_BILLING' | 'OWN_SUBSCRIPTION' | null
}

export interface AgencyMember {
  id: string
  role: AgencyRole
  email: string
  username: string | null
  self: boolean
}

interface AgencyOverview {
  catalog: AgencyCatalog
  attachable: AgencyAttachableBlog[]
  agency: AgencyAccount | null
  role?: AgencyRole
  period?: { start: string; end: string | null } | null
  units?: { available: number; reserved: number }
  aiBudgetLeft?: number | null
  blogs?: AgencyBlog[]
  members?: AgencyMember[]
}

const KNOWN_ERRORS = new Set([
  'RATE_LIMITED',
  'ALREADY_IN_AGENCY',
  'INVALID_QUANTITIES',
  'ALREADY_SUBSCRIBED',
  'SLOTS_BELOW_BLOGS',
  'NOT_SUBSCRIBED',
  'PENDING_PAYMENT',
  'BILLING_CHANGE_PENDING',
  'ALREADY_ATTACHED',
  'SHOPIFY_BILLING',
  'OWN_SUBSCRIPTION',
  'NO_FREE_SLOT',
  'NO_FREE_PREMIUM_SLOT',
  'NO_ACCOUNT',
])

export const useAgency = () => {
  const requestFetch = useRequestFetch()
  return useQuery({
    key: () => queryKeys.agency.overview,
    // Typed by hand: inferring it from the route table exceeds TypeScript's depth limit.
    query: () => requestFetch<AgencyOverview>('/api/agency'),
  })
}

/** Runs one agency change, names a known refusal in the toast and reloads the overview. */
export const useAgencyMutation = <T, R = unknown>(
  mutation: (variables: T) => Promise<R>,
  success?: string | ((result: R) => string | null),
) => {
  const { t } = useI18n()
  const toast = useToast()
  const queryCache = useQueryCache()
  return useMutation({
    mutation,
    onSuccess: (result: R) => {
      const key = typeof success === 'function' ? success(result) : success
      if (key) toast.add({ color: 'success', title: t(key) })
    },
    onError: (error: unknown) => {
      const code = (error as { data?: { data?: { code?: string } } } | null)?.data?.data?.code
      toast.add({
        color: 'error',
        title: t(code && KNOWN_ERRORS.has(code) ? `agency.errors.${code}` : 'agency.errors.generic'),
      })
    },
    onSettled: () => queryCache.invalidateQueries({ key: queryKeys.agency.overview }),
  })
}

export const AGENCY_STATUS_COLORS = {
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  INACTIVE: 'neutral',
  CANCELED: 'error',
} as const satisfies Record<AgencyStatus, string>

/** Quantities picked before the agency exists carry over into its first checkout. */
export const useAgencyDraft = (catalog: AgencyCatalog) =>
  useState('agency-draft', () => ({ blogs: catalog.minBlogs, premium: 0, blocks: catalog.minBlocks }))

/** Slots the attached blogs take; a deleted blog frees its slot, as on the server. */
export const agencySlotsUsed = (blogs: AgencyBlog[]) => {
  const live = blogs.filter((blog) => !blog.deleted)
  return {
    paid: live.filter((blog) => blog.plan !== 'BASIC').length,
    premium: live.filter((blog) => blog.plan === 'PREMIUM').length,
  }
}

export const useUsd = () => {
  const { locale } = useI18n()
  return (cents: number) =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
}

export const initialsOf = (name: string) =>
  name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
