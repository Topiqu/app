/**
 * The published article's body container. Shared by `pages/clanky/[slug].vue` and the editor's
 * preview so the two cannot drift — a preview that styles its own prose stops being a preview
 * the first time either side is touched.
 */
export const ARTICLE_PROSE_CLASS = [
  'w-full max-w-[68ch]',
  'text-[17px] leading-[1.72] md:text-lg',
  // Blank lines the editor emits as `<p></p>`. They were the article's only spacing while
  // base.scss's `* { margin: 0 }` stood unopposed; against real prose margins each one costs a
  // line box plus two margins that no longer collapse through it. `<p><br></p>` and a paragraph
  // closed by `<br>` are the same blank line in different markup — the model emitted those for as
  // long as the schema asked for them (see `dropBlankLines`), so already-saved bodies are full of
  // them and `:empty` matches neither: a `<p>` holding a `<br>` has a child.
  '[&_p:empty]:hidden [&_p:has(>br:only-child)]:hidden [&_p>br:last-child]:hidden',
].join(' ')

/**
 * Tables opt out of `prose` entirely. Every typography rule is `:where(…):not(:where(…))` —
 * specificity 0,0,0 — so the preset's own later rules win on source order alone. `not-prose` is
 * the supported opt-out; the semantic `article-table` hook is styled explicitly in `main.css`,
 * which also avoids relying on Tailwind to discover descendant variants inside this TS constant.
 */
export const ARTICLE_TABLE_CLASS = [
  'article-table not-prose my-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900',
].join(' ')

/**
 * The editing surface uses a separate semantic hook because TipTap adds editor-only chrome: its
 * `.tableWrapper` scroll box, column-resize handles and selected-cell overlay.
 */
export const EDITOR_TABLE_CLASS = 'editor-table'
