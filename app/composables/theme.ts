export const themes: {
  blue: string
  green: string
  red: string
  purple: string
  orange: string
  teal: string
  yellow: string
  pink: string
  indigo: string
  gray: string
  lime: string
  sky: string
  amber: string
  cyan: string
  violet: string
} = {
  blue: 'from-blue-600 to-indigo-900 dark:from-blue-800 dark:to-indigo-950',
  green: 'from-green-600 to-emerald-900 dark:from-green-800 dark:to-emerald-950',
  red: 'from-red-600 to-pink-900 dark:from-red-800 dark:to-pink-950',
  purple: 'from-purple-600 to-indigo-900 dark:from-purple-800 dark:to-indigo-950',
  orange: 'from-orange-500 to-red-600 dark:from-orange-700 dark:to-red-900',
  teal: 'from-teal-600 to-cyan-900 dark:from-teal-800 dark:to-cyan-950',
  yellow: 'from-yellow-400 to-yellow-700 dark:from-yellow-600 dark:to-yellow-900',
  pink: 'from-pink-500 to-fuchsia-800 dark:from-pink-700 dark:to-fuchsia-900',
  indigo: 'from-indigo-600 to-blue-900 dark:from-indigo-800 dark:to-blue-950',
  gray: 'from-gray-400 to-gray-700 dark:from-gray-700 dark:to-gray-900',
  lime: 'from-lime-500 to-green-800 dark:from-lime-700 dark:to-green-900',
  sky: 'from-sky-500 to-blue-700 dark:from-sky-700 dark:to-blue-900',
  amber: 'from-amber-500 to-orange-700 dark:from-amber-700 dark:to-orange-900',
  cyan: 'from-cyan-500 to-teal-800 dark:from-cyan-700 dark:to-teal-900',
  violet: 'from-violet-600 to-purple-900 dark:from-violet-800 dark:to-purple-950',
}

export type ThemeKey = keyof typeof themes

export const themeRings = {
  blue: 'focus-visible:ring-blue-500',
  green: 'focus-visible:ring-green-500',
  red: 'focus-visible:ring-red-500',
  purple: 'focus-visible:ring-purple-500',
  orange: 'focus-visible:ring-orange-500',
  teal: 'focus-visible:ring-teal-500',
  yellow: 'focus-visible:ring-yellow-500',
  pink: 'focus-visible:ring-pink-500',
  indigo: 'focus-visible:ring-indigo-500',
  gray: 'focus-visible:ring-gray-500',
  lime: 'focus-visible:ring-lime-500',
  sky: 'focus-visible:ring-sky-500',
  amber: 'focus-visible:ring-amber-500',
  cyan: 'focus-visible:ring-cyan-500',
  violet: 'focus-visible:ring-violet-500',
} satisfies Record<ThemeKey, string>
