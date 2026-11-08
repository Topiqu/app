import { z } from 'zod'

export type FaqEntry = { question: string; answer: string }

/** What a person may save: complete, trimmed entries. */
export const faqEntriesSchema = z
  .array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(2000) }))
  .max(20)

/** `Article.faq` is a Json column, so every reader has to narrow it before use. */
export const readFaq = (value: unknown): FaqEntry[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is FaqEntry =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as FaqEntry).question === 'string' &&
          typeof (entry as FaqEntry).answer === 'string',
      )
    : []

/** The saved form: trimmed, without the empty rows the editor keeps while typing. */
export const cleanFaq = (entries: readonly FaqEntry[]): FaqEntry[] =>
  entries
    .map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() }))
    .filter(({ question, answer }) => question || answer)

/** A question without an answer, or the reverse, would publish a broken FAQPage entry. */
export const hasIncompleteFaq = (entries: readonly FaqEntry[]) =>
  cleanFaq(entries).some(({ question, answer }) => !question || !answer)
