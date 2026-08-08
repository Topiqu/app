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
  'prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6',
  'dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:prose-invert',
  'dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600',
].join(' ')
