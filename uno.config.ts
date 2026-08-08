import { defineConfig } from 'unocss'
import presetWind3 from '@unocss/preset-wind3'
import presetTypography from '@unocss/preset-typography'

import { Z_LAYERS } from './shared/utils/z-layers'

export default defineConfig({
  // Vite's pipeline scans .vue/.tsx but not plain .ts, and @unocss/nuxt only ever widens the
  // exclude list — so a class list that lives in a shared module generates no CSS at all.
  // `ARTICLE_PROSE_CLASS` hit exactly that: moving it out of the page component silently took
  // every `prose` rule with it, leaving tables at browser defaults (no borders, no padding).
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|vine\.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
        /shared\/.*\.ts($|\?)/,
      ],
    },
  },
  presets: [
    presetWind3(),
    presetTypography({
      cssExtend: {
        // Baseline for tables `Article/Parsed.vue` does not claim (anything not a direct child of
        // body); top-level ones get ARTICLE_TABLE_CLASS and leave prose via `not-prose`. Without
        // `border-collapse` the per-cell borders below double up on every shared edge.
        table: {
          width: '100%',
          'border-collapse': 'collapse',
          'margin-block': '1.5em',
          'font-size': '0.95em',
          'line-height': '1.6',
        },
        'thead th': {
          'background-color': 'rgb(128 128 128 / 0.12)',
          'font-weight': '600',
          'text-align': 'left',
          padding: '0.625em 0.875em',
          border: '1px solid var(--un-prose-th-borders)',
        },
        'tbody td': {
          padding: '0.625em 0.875em',
          border: '1px solid var(--un-prose-td-borders)',
        },
      },
    }),
  ],
  theme: {
    zIndex: Object.fromEntries(Object.entries(Z_LAYERS).map(([name, value]) => [name, String(value)])),
    animation: {
      keyframes: {
        'progress-slide': '{0%{transform:translateX(-110%)}100%{transform:translateX(410%)}}',
      },
      durations: { 'progress-slide': '1.4s' },
      timingFns: { 'progress-slide': 'cubic-bezier(0.4,0,0.2,1)' },
      counts: { 'progress-slide': 'infinite' },
    },
  },
  safelist: [
    'from-blue-600',
    'to-indigo-900',
    'dark:from-blue-800',
    'dark:to-indigo-950',
    'from-green-600',
    'to-emerald-900',
    'dark:from-green-800',
    'dark:to-emerald-950',
    'from-red-600',
    'to-pink-900',
    'dark:from-red-800',
    'dark:to-pink-950',
    'from-purple-600',
    'to-indigo-900',
    'dark:from-purple-800',
    'dark:to-indigo-950',
    'from-orange-500',
    'to-red-600',
    'dark:from-orange-700',
    'dark:to-red-900',
    'from-teal-600',
    'to-cyan-900',
    'dark:from-teal-800',
    'dark:to-cyan-950',
    'from-yellow-400',
    'to-yellow-700',
    'dark:from-yellow-600',
    'dark:to-yellow-900',
    'from-pink-500',
    'to-fuchsia-800',
    'dark:from-pink-700',
    'dark:to-fuchsia-900',
    'from-indigo-600',
    'to-blue-900',
    'dark:from-indigo-800',
    'dark:to-blue-950',
    'from-gray-400',
    'to-gray-700',
    'dark:from-gray-700',
    'dark:to-gray-900',
    'from-lime-500',
    'to-green-800',
    'dark:from-lime-700',
    'dark:to-green-900',
    'from-sky-500',
    'to-blue-700',
    'dark:from-sky-700',
    'dark:to-blue-900',
    'from-amber-500',
    'to-orange-700',
    'dark:from-amber-700',
    'dark:to-orange-900',
    'from-cyan-500',
    'to-teal-800',
    'dark:from-cyan-700',
    'dark:to-teal-900',
    'from-violet-600',
    'to-purple-900',
    'dark:from-violet-800',
    'dark:to-purple-950',
  ],
})
