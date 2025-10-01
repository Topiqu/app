import type { FormSelectItem } from '~/components/Form/Select.vue'

export const locales = [
  { icon: 'twemoji:flag-united-kingdom', label: 'English', value: 'en' as const },
  { icon: 'twemoji:flag-czechia', label: 'Čeština', value: 'cs' as const },
] as const satisfies FormSelectItem[]

export type Language = (typeof locales)[number]['value']
