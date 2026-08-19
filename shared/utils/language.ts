export type Language = 'en' | 'cs'

export const locales: Array<{ icon: string; label: string; value: Language }> = [
  { icon: 'twemoji:flag-united-kingdom', label: 'English', value: 'en' },
  { icon: 'twemoji:flag-czechia', label: 'Čeština', value: 'cs' },
]
