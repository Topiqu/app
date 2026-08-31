/** The broad editorial shape, chosen before the article is written. */
export type ArticleFormat = 'news' | 'analysis' | 'guide' | 'comparison' | 'opinion' | 'story'
export type ArticleModule = 'answer' | 'takeaways' | 'faq' | 'poll' | 'table' | 'images' | 'youtube'

type VariantSpec = { shape: string; structure: string }
type FormatSpec = {
  shape: string
  words: [number, number]
  allowedModules: readonly ArticleModule[]
  /** Backwards-compatible choice for callers without an explicit editorial module selection. */
  defaultModules: readonly ArticleModule[]
  variants: Record<string, VariantSpec>
}

export const ARTICLE_FORMATS = {
  news: {
    shape: 'A report on something that just happened. Lead with what changed and who it hits.',
    words: [350, 550],
    allowedModules: ['answer', 'takeaways', 'poll', 'images', 'youtube'],
    defaultModules: ['answer', 'takeaways'],
    variants: {
      'breaking-brief': {
        shape: 'A concise update built around the new fact.',
        structure: 'Open with the change, establish the previous state, then show the immediate consequence.',
      },
      'impact-first': {
        shape: 'The consequence is more important than the announcement.',
        structure: 'Open with who is affected, explain the change second, then separate immediate and later effects.',
      },
      'timeline-update': {
        shape: 'A developing event explained through its sequence.',
        structure: 'Move chronologically through the decisive moments and end at the newest known state.',
      },
    },
  },
  analysis: {
    shape: 'Takes one claim, number or decision apart and shows what holds up.',
    words: [700, 1100],
    allowedModules: ['answer', 'takeaways', 'table', 'images', 'youtube'],
    defaultModules: ['answer', 'takeaways'],
    variants: {
      'claim-audit': {
        shape: 'Tests one important claim instead of accepting its framing.',
        structure:
          'State the claim precisely, inspect its evidence, expose its limit, then show the practical consequence.',
      },
      'evidence-walkthrough': {
        shape: 'Lets the evidence determine the argument step by step.',
        structure:
          'Start with the strongest observation, add context in evidence order, and end on what the evidence permits.',
      },
      'implication-tree': {
        shape: 'Follows one change into several distinct downstream effects.',
        structure:
          'Name the change, then branch into consequences for different actors or time horizons without recombining them into a verdict.',
      },
      counterfactual: {
        shape: 'Tests a decision by asking what changes if its central assumption is removed.',
        structure:
          'Establish the real case, alter one assumption, trace the resulting differences, and finish on the most revealing contrast.',
      },
    },
  },
  guide: {
    shape: 'Procedural. The reader came to do the thing, not to read about it.',
    words: [700, 1100],
    allowedModules: ['answer', 'takeaways', 'faq', 'images', 'youtube'],
    defaultModules: ['answer', 'takeaways', 'faq'],
    variants: {
      'step-by-step': {
        shape: 'A sequence the reader can execute in order.',
        structure:
          'Begin with the required starting state, proceed in dependency order, and finish at a verifiable result.',
      },
      checklist: {
        shape: 'A bounded set of checks for a reader who already knows the basics.',
        structure:
          'Group checks by decision point or risk, explain the pass condition, and avoid turning the list into a tutorial.',
      },
      troubleshooting: {
        shape: 'Diagnoses why an expected result did not happen.',
        structure:
          'Open with observable symptoms, move from likely causes to rarer ones, and pair every diagnosis with a test.',
      },
      'decision-tree': {
        shape: 'Routes different readers to different actions.',
        structure:
          'Start with the decisive question, branch by answer, and keep each branch self-contained instead of forcing one universal recommendation.',
      },
    },
  },
  comparison: {
    shape: 'Two or more options side by side, with the case for each and who it suits.',
    words: [600, 900],
    allowedModules: ['answer', 'takeaways', 'faq', 'poll', 'table', 'images', 'youtube'],
    defaultModules: ['answer', 'takeaways', 'faq', 'table'],
    variants: {
      'head-to-head': {
        shape: 'Compares the same decision criteria across every option.',
        structure:
          'Define the criteria once, compare each option on those criteria, and let suitability differ by reader.',
      },
      'scenario-based': {
        shape: 'Changes the best option as the reader scenario changes.',
        structure:
          'Introduce distinct real-world scenarios and evaluate every option inside each one rather than declaring an overall winner.',
      },
      'tradeoff-analysis': {
        shape: 'Makes the cost of each advantage explicit.',
        structure:
          'Pair every meaningful strength with what it gives up, then show which tradeoff matters under which constraint.',
      },
      'migration-path': {
        shape: 'Compares staying, switching and the transition between them.',
        structure:
          'Establish the current state, examine switching costs and risks, then map the cases where migration is justified.',
      },
    },
  },
  opinion: {
    shape: "An argument in the author's own voice. It takes a position and defends it.",
    words: [500, 800],
    allowedModules: ['poll', 'images', 'youtube'],
    defaultModules: ['poll'],
    variants: {
      'contrarian-case': {
        shape: 'Defends a position that cuts against the usual framing.',
        structure:
          'Name the conventional view fairly, make the opposing case from specifics, and finish on its hardest implication.',
      },
      'principle-first': {
        shape: 'Derives a position from one clearly stated principle.',
        structure:
          'State the principle, apply it to progressively harder cases, and let the final application carry the ending.',
      },
      'open-letter': {
        shape: 'Addresses a concrete group with a specific request or warning.',
        structure:
          'Name the addressee and stakes, develop the case directly, and close with the action being asked of them.',
      },
      'steelman-rebuttal': {
        shape: 'Presents the strongest opposing case before answering it.',
        structure:
          'Build the opposition without caricature, identify the point of disagreement, then defend the article position there.',
      },
    },
  },
  story: {
    shape: 'A narrative — one case, one person, one sequence of events, told in order.',
    words: [600, 900],
    allowedModules: ['images', 'youtube'],
    defaultModules: [],
    variants: {
      chronology: {
        shape: 'A sequence whose meaning emerges from the order of events.',
        structure:
          'Begin at the first consequential moment, move forward without thematic detours, and stop when the sequence resolves.',
      },
      'before-after': {
        shape: 'A transformation shown through two concrete states.',
        structure:
          'Make the before state tangible, narrate the change itself, then show the after state without adding a separate lesson section.',
      },
      'case-study': {
        shape: 'One bounded case examined through decisions and outcomes.',
        structure:
          'Set the constraints, follow the choices made, show the observed outcome, and leave generalisation to the reader.',
      },
      'failure-postmortem': {
        shape: 'A failure reconstructed without hindsight theatre.',
        structure:
          'Start from what failed, reconstruct the decisions with knowledge available at the time, and end at the corrective change.',
      },
    },
  },
} as const satisfies Record<ArticleFormat, FormatSpec>

export const ARTICLE_FORMAT_NAMES = Object.keys(ARTICLE_FORMATS) as ArticleFormat[]
export const ARTICLE_MODULE_NAMES = ['answer', 'takeaways', 'faq', 'poll', 'table', 'images', 'youtube'] as const
export const ARTICLE_STRUCTURE_VARIANTS = ARTICLE_FORMAT_NAMES.flatMap((format) =>
  Object.keys(ARTICLE_FORMATS[format].variants),
)
export type ArticleStructureVariant = (typeof ARTICLE_STRUCTURE_VARIANTS)[number]

export const isArticleFormat = (value: unknown): value is ArticleFormat =>
  typeof value === 'string' && value in ARTICLE_FORMATS
export const isStructureVariantFor = (format: ArticleFormat, variant: string) =>
  variant in ARTICLE_FORMATS[format].variants
export const allowedModulesFor = (format: ArticleFormat): readonly ArticleModule[] =>
  ARTICLE_FORMATS[format].allowedModules
export const selectedModulesFor = (format: ArticleFormat, modules?: readonly ArticleModule[]) => {
  const requested = modules ?? ARTICLE_FORMATS[format].defaultModules
  const allowed = new Set<ArticleModule>(ARTICLE_FORMATS[format].allowedModules)
  return [...new Set(requested)].filter((module) => allowed.has(module))
}

/** The picker sees both broad formats and the structures/modules it can deliberately rotate. */
export const formatMenu = () =>
  ARTICLE_FORMAT_NAMES.map((name) => {
    const variants = Object.entries(ARTICLE_FORMATS[name].variants)
      .map(([variant, spec]) => `${variant} (${spec.shape})`)
      .join('; ')
    return `- ${name}: ${ARTICLE_FORMATS[name].shape}\n  Variants: ${variants}\n  Optional modules: ${ARTICLE_FORMATS[name].allowedModules.join(', ') || 'none'}`
  }).join('\n')

export const ANTI_FORMULA = `
Never do these. They are what makes writing read as machine-made:
- No closing summary, verdict or takeaway section. The article ends on its last substantive point — no heading named Verdict, Conclusion, Summary, Verdikt, Závěr or Shrnutí, and no final paragraph that restates the piece.
- Never use the contrast pair "It is not X, it is Y" / "not X, but Y" / "X, not Y". Once is already a tell; the pattern is unusable.
- Do not open with throat-clearing: no "Imagine…", "Let's look at…", "In this article we will…", "First, let's set some assumptions".
- No rhetorical question as a heading.
- Do not close a section with an aphorism that restates what the section just said.
- Vary it: sentence length, paragraph length, and the number of paragraphs per section must differ across the article.
- Write the specific noun. No "it", "this" or "that" standing in for the subject of a paragraph.
`.trim()

const moduleRules = (selected: readonly ArticleModule[]) => {
  const has = (module: ArticleModule) => selected.includes(module)
  return [
    has('table')
      ? 'This article may use an HTML table, but only if readers compare the same facts across rows.'
      : 'This article must NOT contain an HTML table.',
    has('poll')
      ? 'This article may use one reader poll where a genuine choice or disagreement remains.'
      : 'This article must NOT contain a reader poll.',
    has('images')
      ? 'This article must contain 1-4 useful images in the body, each represented by a numbered image slot and matching image instruction.'
      : 'This article must NOT contain images in the body.',
    has('youtube')
      ? 'This article should embed one relevant YouTube video when the research provides a real YouTube URL. Never invent a URL.'
      : 'This article must NOT contain a YouTube video.',
  ].join('\n')
}

const extractionRules = (selected: readonly ArticleModule[]) => {
  const has = (module: ArticleModule) => selected.includes(module)
  return [
    has('answer')
      ? '- "answer": lead with the answer itself and name the subject explicitly. 40-60 words.'
      : '- "answer": return an empty string.',
    has('takeaways')
      ? '- "keyTakeaways": 3-5 standalone facts — "Prices rose 12% in 2025", not "We look at how prices moved".'
      : '- "keyTakeaways": return an empty array.',
    has('faq')
      ? '- "faq": 2-5 questions a reader would actually type. Fewer is better and [] is valid when the evidence raises no real questions.'
      : '- "faq": return an empty array.',
  ].join('\n')
}

/** Undefined format is the manual editor flow and retains its existing broad freedom. */
export const formatRules = (
  format?: ArticleFormat,
  variant?: ArticleStructureVariant | null,
  modules?: readonly ArticleModule[],
) => {
  if (!format)
    return `
Length: 500-1000 words.
Tables, polls and videos are optional and the default is none. Add one only when it carries information prose would carry worse.

Extraction fields:
- "answer": 40-60 words answering the title outright, or an empty string.
- "keyTakeaways": 3-5 standalone facts, or [].
- "faq": 2-5 real reader questions, or [].
All three are in the article's language and every claim in them is also supported by the body.

${ANTI_FORMULA}
`.trim()

  const spec = ARTICLE_FORMATS[format]
  const selected = selectedModulesFor(format, modules)
  const variants = spec.variants as Record<string, VariantSpec>
  const variantSpec = variant && isStructureVariantFor(format, variant) ? variants[variant] : null

  return `
Format: ${format}. ${spec.shape}
${variantSpec ? `Structure variant: ${variant}. ${variantSpec.shape}\nRequired progression: ${variantSpec.structure}` : ''}
Length: ${spec.words[0]}-${spec.words[1]} words. Follow the progression, but choose natural headings rather than naming its steps.
${moduleRules(selected)}

Extraction fields:
${extractionRules(selected)}
They are in the article's language and every claim in them is also supported by the body.

${ANTI_FORMULA}
`.trim()
}

type Formattable = {
  answer?: string
  keyTakeaways?: string[]
  faq?: { question: string; answer: string }[]
  polls?: unknown[]
  images?: unknown[]
  videos?: unknown[]
}

/** Hard boundary for structured modules; the prompt is guidance, this is enforcement. */
export const applyFormat = <T extends Formattable>(
  object: T,
  format?: ArticleFormat,
  modules?: readonly ArticleModule[],
): T => {
  if (!format) return object
  const selected = selectedModulesFor(format, modules)
  const has = (module: ArticleModule) => selected.includes(module)

  return {
    ...object,
    answer: has('answer') ? object.answer : '',
    keyTakeaways: has('takeaways') ? object.keyTakeaways : [],
    faq: has('faq') ? object.faq : [],
    polls: has('poll') ? object.polls : [],
    images: has('images') ? object.images : [],
    videos: has('youtube') ? object.videos : [],
  } as T
}
