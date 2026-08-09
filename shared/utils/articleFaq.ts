export type FaqEntry = { question: string; answer: string }

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
