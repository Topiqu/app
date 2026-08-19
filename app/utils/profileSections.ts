export type ProfileTab = 'profile' | 'security' | 'notifications' | 'activity'

// Deep links (account-health checks, links from elsewhere in the app) name a section, not a tab.
// The section must therefore resolve to the tab that renders it, or the link lands on a hidden panel.
const SECTION_TAB: Record<string, ProfileTab> = {
  'username-section': 'profile',
  'bio-section': 'profile',
  'language-section': 'profile',
  'id-section': 'profile',
  'registration-section': 'profile',
  'email-section': 'security',
  'password-section': 'security',
  '2fa-section': 'security',
  'sessions-section': 'security',
  'events-section': 'security',
  'notifications-section': 'notifications',
}

export function sectionId(hashOrId: string) {
  return hashOrId.replace(/^#/, '')
}

export function tabForSection(hashOrId: string): ProfileTab | undefined {
  return SECTION_TAB[sectionId(hashOrId)]
}

export function toHandle(username?: string | null) {
  return username?.toLowerCase().replace(/\s+/g, '') ?? ''
}
