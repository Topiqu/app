import type { GenerationReviewIssue } from '~~/shared/utils/articleGeneration'

/** System-written issues carry a translated `key`; the copy desk's own notes are already in the interface language. */
export const useReviewIssueText = () => {
  const { t, te } = useI18n()
  const issueLabel = (code: string) =>
    te(`articles.editor.ai.run.issue.${code}`) ? t(`articles.editor.ai.run.issue.${code}`) : code
  const issueNote = ({ key, params, note }: GenerationReviewIssue) =>
    key && te(`articles.editor.ai.run.note.${key}`) ? t(`articles.editor.ai.run.note.${key}`, params ?? {}) : note
  return { issueLabel, issueNote }
}
