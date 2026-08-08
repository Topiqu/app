/**
 * The published article's body container. Shared by `pages/clanky/[slug].vue` and the editor's
 * preview so the two cannot drift — a preview that styles its own prose stops being a preview
 * the first time either side is touched.
 */
export const ARTICLE_PROSE_CLASS = [
  'max-w-[1000px] bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100',
  'text-[17px] md:text-lg leading-[1.8] text-gray-800 space-y-6',
  'prose prose-gray prose-a:text-blue-600 hover:prose-a:text-blue-800',
  'prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl',
  'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic',
  // Indent lives on the list, not the item: `prose-li:ml-6` stacked on the preset's own
  // `padding-inline-start` and the marker ended up ~52px in, from two rules in two places.
  'prose-ul:list-disc prose-ol:list-decimal',
  'dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:prose-invert',
  'dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600',
].join(' ')

/**
 * Tables opt out of `prose` entirely. Every typography rule is `:where(…):not(:where(…))` —
 * specificity 0,0,0 — so the preset's own later rules win on source order alone: they overrode
 * the `cssExtend` cell padding and zeroed the inline padding of first/last cells. Winning that
 * race means matching the preset's internal selector strings, which is not a contract. `not-prose`
 * is, so the wrapper claims the table and styles it outright. Rules sit on the row, not the cell,
 * so adjacent borders cannot double up.
 */
const TABLE_CELLS = [
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.95em] [&_table]:leading-relaxed',
  '[&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_th]:bg-gray-50 [&_th]:text-gray-900 dark:[&_th]:bg-gray-800 dark:[&_th]:text-gray-100',
  '[&_td]:px-3.5 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-gray-700 dark:[&_td]:text-gray-300',
  '[&_tbody_tr]:border-t [&_tbody_tr]:border-gray-200 dark:[&_tbody_tr]:border-gray-700',
]

export const ARTICLE_TABLE_CLASS = [
  'not-prose my-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700',
  ...TABLE_CELLS,
].join(' ')

/**
 * The editing surface. Same cells as the published table, plus the chrome only TipTap emits:
 * its `.tableWrapper` scroll box, the column-resize handle and the selected-cell tint. Vertical
 * dividers are deliberate here and absent when published — while editing, cell bounds are an
 * affordance; while reading, they are noise.
 */
export const EDITOR_TABLE_CLASS = [
  ...TABLE_CELLS,
  '[&_.tableWrapper]:my-6 [&_.tableWrapper]:overflow-x-auto',
  '[&_table]:rounded-lg [&_table]:border [&_table]:border-gray-200 dark:[&_table]:border-gray-700',
  '[&_th]:border [&_th]:border-gray-200 dark:[&_th]:border-gray-700',
  '[&_td]:border [&_td]:border-gray-200 dark:[&_td]:border-gray-700',
  '[&_.selectedCell]:bg-blue-100/60 dark:[&_.selectedCell]:bg-blue-900/40',
  '[&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-blue-500',
].join(' ')
