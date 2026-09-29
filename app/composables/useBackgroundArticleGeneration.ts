import type { GenerationRun } from '~~/shared/utils/articleGeneration'

export interface BackgroundArticleGeneration {
  editorPath: string
  title: string
  run: GenerationRun
}

/** Shared with the app shell so progress stays visible after leaving the editor. */
export const useBackgroundArticleGeneration = () =>
  useState<BackgroundArticleGeneration | null>('background-article-generation', () => null)
