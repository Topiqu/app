/**
 * The model's paragraph padding. It used to be asked for `<br>` at the end of every paragraph, back
 * when the body was raw `v-html` under `base.scss`'s global `margin: 0` and that break was the only
 * thing separating two paragraphs. `presetTypography` now owns the rhythm, so each one is a spare
 * line box on top of a real margin — and `[&_p:empty]:hidden` never caught them, because a `<p>`
 * holding a `<br>` is not `:empty`. Only a break that closes a block goes; one mid-paragraph is a
 * deliberate line break (the image attribution emits exactly that).
 */
export const dropBlankLines = (html: string) =>
  html
    .replace(/(?:\s*<br\s*\/?>)+\s*(?=<\/(?:p|h[1-6]|li|blockquote|figcaption|td|th)>)/gi, '')
    .replace(/<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')

/**
 * Mirrors `Article`'s ZenStack rule (`admin && clientSiteId == auth().clientSiteId`) — authorship
 * is deliberately not part of it, so a tenant's admins can edit each other's articles and the
 * AI author's articles, which no human owns. A stricter client gate only hides a button the
 * server would have accepted. Superadmin is excluded because the policy excludes it too.
 */
export const canManageArticle = (
  user: { role?: string | null; clientSiteId?: string | null } | null | undefined,
  article: { clientSiteId?: string | null } | null | undefined,
) => !!user && user.role === 'admin' && !!user.clientSiteId && user.clientSiteId === article?.clientSiteId

/**
 * Nothing written yet. TipTap normalises an emptied body to `<p></p>` rather than `''`, so both
 * spellings have to count as empty — which is why this lives in one place instead of being
 * re-typed wherever the editor asks the question.
 */
export const isBlankArticle = (article: { title?: string | null; content?: string | null }) =>
  !article.title && (!article.content || article.content === '<p></p>')

export type PublishAction = 'saveChanges' | 'schedule' | 'createAndPublish' | 'publishNow'

/**
 * What the primary editor button actually does, as an `articles.*` key. A future `releaseAt`
 * makes it queue rather than publish, which the button used to hide behind "Publikovat".
 */
export const publishAction = (
  article: { status?: string | null; releaseAt?: string | Date | null },
  isNew: boolean,
  now: Date = new Date(),
): PublishAction => {
  if (article.status === 'published') return 'saveChanges'
  if (article.releaseAt && new Date(article.releaseAt).getTime() > now.getTime()) return 'schedule'

  return isNew ? 'createAndPublish' : 'publishNow'
}
