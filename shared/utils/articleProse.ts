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
