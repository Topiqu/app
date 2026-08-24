/**
 * The published article's body container. Shared by `pages/clanky/[slug].vue` and the editor's
 * preview so the two cannot drift — a preview that styles its own prose stops being a preview
 * the first time either side is touched.
 */
export const ARTICLE_PROSE_CLASS = [
  'prose w-full max-w-[68ch]',
  'text-[17px] leading-[1.72] md:text-lg',
  'prose-a:text-primary hover:prose-a:underline',
  // The body repeats the title as its own h1 under `Hero.vue`'s, so it opens the column rather
  // than continuing it — the preset's top margin has nothing to separate it from.
  'prose-h1:mt-0 prose-h1:mb-5',
  'prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl',
  'prose-p:my-5 prose-li:my-1.5 prose-ul:my-5 prose-ol:my-5 prose-blockquote:my-8',
  // Indent lives on the list, not the item: `prose-li:ml-6` stacked on the preset's own
  // `padding-inline-start` and the marker ended up ~52px in, from two rules in two places.
  'prose-ul:list-disc prose-ol:list-decimal',
  // Generated images arrive as `<p style="text-align:center"><img></p>`, so the paragraph already
  // carries a full margin. `<img>` is a replaced element — vertical margins *do* apply to it inline
  // — so any margin here stacks on that one instead of replacing it.
  'prose-img:my-0 prose-figure:my-8 prose-video:my-8 prose-hr:my-10',
  // Blank lines the editor emits as `<p></p>`. They were the article's only spacing while
  // base.scss's `* { margin: 0 }` stood unopposed; against real prose margins each one costs a
  // line box plus two margins that no longer collapse through it. `<p><br></p>` and a paragraph
  // closed by `<br>` are the same blank line in different markup — the model emitted those for as
  // long as the schema asked for them (see `dropBlankLines`), so already-saved bodies are full of
  // them and `:empty` matches neither: a `<p>` holding a `<br>` has a child.
  '[&_p:empty]:hidden [&_p:has(>br:only-child)]:hidden [&_p>br:last-child]:hidden',
  'dark:prose-invert',
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
  '[&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:text-[0.95em] [&_table]:leading-relaxed',
  '[&_th]:border-b [&_th]:border-gray-300 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide',
  '[&_th]:bg-gray-100 [&_th]:text-gray-800 dark:[&_th]:border-gray-600 dark:[&_th]:bg-gray-800 dark:[&_th]:text-gray-100',
  '[&_td]:border-b [&_td]:border-gray-200 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_td]:text-gray-700 dark:[&_td]:border-gray-700 dark:[&_td]:text-gray-300',
  '[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:nth-child(even)]:bg-gray-50/70 dark:[&_tbody_tr:nth-child(even)]:bg-gray-800/35',
  '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-blue-50/70 dark:[&_tbody_tr:hover]:bg-blue-950/25',
]

export const ARTICLE_TABLE_CLASS = [
  'not-prose my-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900',
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
