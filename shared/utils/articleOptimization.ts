import type {
  ArticleOptimizationInput,
  ArticleOptimizationResult,
  ContentEvaluationState,
  OptimizationCategory,
  OptimizationCheck,
  OptimizationStatus,
  OptimizationTarget,
} from '../types/articleOptimization'

const categories: OptimizationCategory[] = ['seo', 'ai-visibility', 'readability', 'trust']
const genericHeadings = new Set(['úvod', 'závěr', 'shrnutí', 'intro', 'introduction', 'conclusion', 'summary'])

export const optimizationRuleIds = [
  'title-exists',
  'title-length',
  'excerpt-exists',
  'excerpt-length',
  'single-h1',
  'heading-hierarchy',
  'internal-link',
  'external-link',
  'featured-image',
  'image-alt',
  'paragraph-length',
  'sentence-length',
  'section-length',
  'long-article-structure',
  'topic-introduction',
  'descriptive-sections',
  'heading-quality',
  'multiple-blocks',
  'sources-exist',
  'sources-valid',
  'external-links-safe',
  'source-diversity',
] as const

type RuleId = (typeof optimizationRuleIds)[number]

export const optimizationScoringConfig = {
  substantialContent: { minimumProseWords: 120 },
  criteria: {
    titleCharacters: { minimum: 30, maximum: 65 },
    excerptCharacters: { minimum: 70, maximum: 160 },
    maximumParagraphWords: 120,
    maximumSentenceWords: 35,
    maximumLongSentenceRatio: 0.1,
    maximumSectionWords: 300,
    structuredArticleMinimumWords: 250,
    minimumParagraphsForLongArticle: 2,
    minimumHeadingsForLongArticle: 2,
    topicIntroductionWords: 120,
    significantTitleWordMinimumLength: 4,
    minimumTopicWordCoverage: 0.5,
    sourceDiversityMinimumWords: 800,
    minimumSourceDomains: 2,
  },
  weights: {
    'title-exists': 2,
    'title-length': 1,
    'excerpt-exists': 2,
    'excerpt-length': 1,
    'single-h1': 2,
    'heading-hierarchy': 1,
    'internal-link': 1,
    'external-link': 1,
    'featured-image': 1,
    'image-alt': 1,
    'paragraph-length': 2,
    'sentence-length': 2,
    'section-length': 1,
    'long-article-structure': 2,
    'topic-introduction': 2,
    'descriptive-sections': 1,
    'heading-quality': 1,
    'multiple-blocks': 1,
    'sources-exist': 2,
    'sources-valid': 1,
    'external-links-safe': 2,
    'source-diversity': 1,
  } satisfies Record<RuleId, number>,
  seoCaps: {
    withoutSubstantialContent: 0,
    withoutTitle: 25,
    invalidSingleH1: 60,
    invalidHeadingHierarchy: 70,
  },
} as const

export const articleGenerationOptimizationInstructions = (tenantDomain?: string | null) => {
  const { criteria } = optimizationScoringConfig
  const internalDestination = tenantDomain?.trim() ? `https://${tenantDomain.trim().replace(/^https?:\/\//, '')}` : '/'

  return `
Article optimization requirements (apply them while drafting; never mention this checklist in the article):
- Write a title of ${criteria.titleCharacters.minimum}-${criteria.titleCharacters.maximum} characters and a perex/meta description of ${criteria.excerptCharacters.minimum}-${criteria.excerptCharacters.maximum} characters.
- The body must contain meaningful prose and start with h2. Never put an h1 in the body. Use h2 and h3 in order without skipping heading levels.
- Use at least ${criteria.minimumHeadingsForLongArticle} descriptive section headings for articles longer than ${criteria.structuredArticleMinimumWords} words. Do not use a one-word generic heading such as Introduction, Summary, Conclusion, Úvod, Shrnutí or Závěr.
- Naturally repeat at least half of the meaningful words from the title within the first ${criteria.topicIntroductionWords} body words.
- Keep every paragraph at or below ${criteria.maximumParagraphWords} words, every uninterrupted section at or below ${criteria.maximumSectionWords} words, and at least 90% of sentences at or below ${criteria.maximumSentenceWords} words.
- Include one contextually useful internal link to ${internalDestination}. Use a relative href when possible.
- When live research supplied sources, link at least one supported statement to the most relevant source URL exactly as supplied. Never invent a URL merely to satisfy this requirement.
- Every body image must have a concise, meaningful alt description derived from its caption.
- Before returning JSON, silently check these requirements and correct avoidable failures. Optimize for clarity and accuracy first; do not add filler, unsafe links or unsupported claims merely to improve a score.
`.trim()
}

const words = (text: string) => text.trim().match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []

export const getContentEvaluationState = (
  article: Pick<ArticleOptimizationInput, 'content'>,
): ContentEvaluationState => {
  const doc = new DOMParser().parseFromString(article.content || '', 'text/html')
  doc.querySelectorAll('script, style, noscript, img, video, audio, iframe').forEach((node) => node.remove())
  const normalizedWords = words(doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  if (!normalizedWords.length) return 'empty'

  const proseBlocks = [...doc.querySelectorAll('p, blockquote')]
  const proseWordCount = proseBlocks.length
    ? proseBlocks.reduce((total, node) => total + words(node.textContent ?? '').length, 0)
    : doc.body.children.length === 0
      ? normalizedWords.length
      : 0
  return proseWordCount >= optimizationScoringConfig.substantialContent.minimumProseWords
    ? 'substantial'
    : 'insufficient'
}
export const splitSentences = (text: string) =>
  text
    .trim()
    .split(/(?<=[.!?…])(?:["”’)]*)\s+(?=[\p{Lu}\p{N}])/u)
    .map((part) => part.trim())
    .filter(Boolean)

const validHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export const classifyArticleUrl = (href: string, tenantDomain?: string | null): 'internal' | 'external' | 'invalid' => {
  const value = href.trim()
  if (!value || /^(javascript|data|vbscript):/i.test(value)) return 'invalid'
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('?')) return 'internal'
  if (!validHttpUrl(value)) return 'invalid'
  const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
  const tenant = (tenantDomain ?? '')
    .replace(/^https?:\/\//, '')
    .split('/')[0]!
    .split(':')[0]!
    .replace(/^www\./, '')
    .toLowerCase()
  return tenant && (hostname === tenant || hostname.endsWith(`.${tenant}`)) ? 'internal' : 'external'
}

export const scoreOptimizationChecks = (
  checks: OptimizationCheck[],
  contentState: ContentEvaluationState = 'substantial',
): ArticleOptimizationResult => {
  const categoryScores = categories.map((category) => {
    if ((category === 'ai-visibility' || category === 'readability') && contentState !== 'substantial')
      return { category, status: 'insufficient-data' as const, score: null }
    const applicable = checks.filter((check) => check.category === category && check.status !== 'not-applicable')
    const total = applicable.reduce((sum, check) => sum + check.weight, 0)
    const earned = applicable.reduce(
      (sum, check) => sum + check.weight * (check.status === 'passed' ? 1 : check.status === 'warning' ? 0.5 : 0),
      0,
    )
    let score = total ? Math.round((earned / total) * 100) : 100
    if (category === 'seo') {
      if (contentState !== 'substantial') score = optimizationScoringConfig.seoCaps.withoutSubstantialContent
      else {
        const status = (id: RuleId) => checks.find((check) => check.id === id)?.status
        if (status('title-exists') === 'error') score = Math.min(score, optimizationScoringConfig.seoCaps.withoutTitle)
        if (status('single-h1') === 'error') score = Math.min(score, optimizationScoringConfig.seoCaps.invalidSingleH1)
        if (status('heading-hierarchy') === 'error')
          score = Math.min(score, optimizationScoringConfig.seoCaps.invalidHeadingHierarchy)
      }
    }
    return { category, status: 'evaluated' as const, score }
  })
  const evaluatedScores = categoryScores.flatMap((item) => (item.score === null ? [] : [item.score]))
  return {
    categories: categoryScores,
    overallScore:
      contentState !== 'substantial'
        ? 0
        : evaluatedScores.length
          ? Math.round(evaluatedScores.reduce((sum, score) => sum + score, 0) / evaluatedScores.length)
          : 0,
    contentState,
    checks,
    counts: {
      issues: checks.filter((check) => check.status === 'error').length,
      recommendations: checks.filter((check) => check.status === 'warning').length,
      passed: checks.filter((check) => check.status === 'passed').length,
    },
  }
}

export const analyzeArticleOptimization = (input: ArticleOptimizationInput): ArticleOptimizationResult => {
  const doc = new DOMParser().parseFromString(input.content || '', 'text/html')
  const blocks = [...doc.body.children]
  const text = doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const allWords = words(text)
  const headings = blocks.flatMap((node, index) =>
    /^H[1-6]$/.test(node.tagName) ? [{ node, index, level: Number(node.tagName[1]) }] : [],
  )
  const paragraphs = blocks.flatMap((node, index) => (node.tagName === 'P' ? [{ node, index }] : []))
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')]
  const linkKinds = links.map((link) => classifyArticleUrl(link.getAttribute('href') ?? '', input.tenantDomain))
  const title = input.title.trim()
  const excerpt = input.excerpt?.trim() ?? ''
  const contentState = getContentEvaluationState(input)
  const hasCore = Boolean(title || text)
  const check = (
    id: RuleId,
    category: OptimizationCategory,
    status: OptimizationStatus,
    target: OptimizationTarget,
    meta?: Record<string, string | number>,
    details?: OptimizationCheck['details'],
  ): OptimizationCheck => ({
    id,
    category,
    status,
    target,
    weight: optimizationScoringConfig.weights[id],
    source: 'local',
    meta,
    details,
  })
  const dependent = (status: OptimizationStatus) => (hasCore ? status : 'not-applicable')
  const firstBadParagraph = paragraphs.find(({ node }) => words(node.textContent ?? '').length > 120)
  const sentences = splitSentences(text)
  const longSentenceRatio = sentences.length
    ? sentences.filter((sentence) => words(sentence).length > 35).length / sentences.length
    : 0
  let sectionWords = 0
  let oversizedSection = -1
  blocks.forEach((node, index) => {
    if (/^H[1-6]$/.test(node.tagName)) sectionWords = 0
    else sectionWords += words(node.textContent ?? '').length
    if (sectionWords > 300 && oversizedSection < 0) oversizedSection = index
  })
  const headingJump = headings.find((heading, index) =>
    index === 0 ? heading.level !== 2 : heading.level > headings[index - 1]!.level + 1,
  )
  const badHeading = headings.find(({ node }) => {
    const value = node.textContent?.trim().toLowerCase() ?? ''
    return !value || (words(value).length === 1 && genericHeadings.has(value))
  })
  const significantTitleWords = words(title.toLowerCase()).filter((word) => word.length >= 4)
  const intro = words(text).slice(0, 120).join(' ').toLowerCase()
  const topicHits = significantTitleWords.filter((word) => intro.includes(word)).length
  const sourceEntries = input.sources
    .map((source, index) => ({ source: source.trim(), index }))
    .filter(({ source }) => Boolean(source))
  const invalidSource = sourceEntries.find(({ source }) => !validHttpUrl(source))
  const validSources = sourceEntries.filter(({ source }) => validHttpUrl(source))
  const sourceLinkKinds = validSources.map(({ source }) => classifyArticleUrl(source, input.tenantDomain))
  const sourceDomains = new Set(validSources.map(({ source }) => new URL(source).hostname.replace(/^www\./, '')))
  const images = [...doc.querySelectorAll<HTMLImageElement>('img')]
  const badImage = images.find((image) => !image.getAttribute('alt')?.trim())
  const imageBlock = badImage ? blocks.findIndex((node) => node === badImage || node.contains(badImage)) : -1
  const checks: OptimizationCheck[] = [
    check('title-exists', 'seo', title ? 'passed' : 'error', { kind: 'title' }),
    check(
      'title-length',
      'seo',
      !title ? 'not-applicable' : title.length >= 30 && title.length <= 65 ? 'passed' : 'warning',
      { kind: 'title' },
      { current: title.length },
    ),
    check('excerpt-exists', 'seo', excerpt ? 'passed' : 'error', { kind: 'excerpt' }),
    check(
      'excerpt-length',
      'seo',
      !excerpt ? 'not-applicable' : excerpt.length >= 70 && excerpt.length <= 160 ? 'passed' : 'warning',
      { kind: 'excerpt' },
      { current: excerpt.length },
    ),
    check('single-h1', 'seo', !title ? 'not-applicable' : doc.querySelector('h1') ? 'error' : 'passed', {
      kind: 'content',
      blockIndex: headings.find((h) => h.level === 1)?.index,
    }),
    check('heading-hierarchy', 'seo', dependent(!headings.length ? 'warning' : headingJump ? 'error' : 'passed'), {
      kind: 'content',
      blockIndex: headingJump?.index,
    }),
    check('internal-link', 'seo', dependent(linkKinds.includes('internal') ? 'passed' : 'warning'), {
      kind: 'content',
    }),
    check(
      'external-link',
      'seo',
      dependent(linkKinds.includes('external') || sourceLinkKinds.includes('external') ? 'passed' : 'warning'),
      { kind: 'sources' },
    ),
    check('featured-image', 'seo', input.imageUrl?.trim() ? 'passed' : 'warning', { kind: 'featured-image' }),
    check('image-alt', 'seo', !images.length ? 'not-applicable' : badImage ? 'error' : 'passed', {
      kind: 'content',
      blockIndex: imageBlock >= 0 ? imageBlock : undefined,
    }),
    check('paragraph-length', 'readability', dependent(firstBadParagraph ? 'warning' : 'passed'), {
      kind: 'content',
      blockIndex: firstBadParagraph?.index,
    }),
    check(
      'sentence-length',
      'readability',
      !sentences.length ? 'not-applicable' : longSentenceRatio > 0.1 ? 'warning' : 'passed',
      { kind: 'content' },
    ),
    check('section-length', 'readability', dependent(oversizedSection >= 0 ? 'warning' : 'passed'), {
      kind: 'content',
      blockIndex: oversizedSection >= 0 ? oversizedSection : undefined,
    }),
    check(
      'long-article-structure',
      'readability',
      allWords.length <= 250 ? 'not-applicable' : paragraphs.length >= 2 && headings.length >= 2 ? 'passed' : 'warning',
      { kind: 'content' },
    ),
    check(
      'topic-introduction',
      'ai-visibility',
      !title || !text || !significantTitleWords.length
        ? 'not-applicable'
        : topicHits / significantTitleWords.length >= 0.5
          ? 'passed'
          : 'warning',
      { kind: 'content', blockIndex: 0 },
    ),
    check(
      'descriptive-sections',
      'ai-visibility',
      allWords.length <= 250
        ? 'not-applicable'
        : headings.filter((h) => h.level >= 2).length >= 2
          ? 'passed'
          : 'warning',
      { kind: 'content' },
    ),
    check('heading-quality', 'ai-visibility', !headings.length ? 'not-applicable' : badHeading ? 'warning' : 'passed', {
      kind: 'content',
      blockIndex: badHeading?.index,
    }),
    check('multiple-blocks', 'ai-visibility', dependent(blocks.length >= 2 ? 'passed' : 'warning'), {
      kind: 'content',
      blockIndex: 0,
    }),
    check('sources-exist', 'trust', sourceEntries.length ? 'passed' : 'warning', { kind: 'sources' }),
    check(
      'sources-valid',
      'trust',
      !sourceEntries.length ? 'not-applicable' : invalidSource ? 'error' : 'passed',
      { kind: 'sources', blockIndex: invalidSource?.index },
      invalidSource ? { number: invalidSource.index + 1 } : undefined,
      invalidSource ? { itemNumber: invalidSource.index + 1, value: invalidSource.source } : undefined,
    ),
    check(
      'external-links-safe',
      'trust',
      !links.length || (!linkKinds.includes('external') && !linkKinds.includes('invalid'))
        ? 'not-applicable'
        : linkKinds.includes('invalid')
          ? 'error'
          : 'passed',
      { kind: 'content' },
    ),
    check(
      'source-diversity',
      'trust',
      allWords.length < 800 ? 'not-applicable' : sourceDomains.size >= 2 ? 'passed' : 'warning',
      { kind: 'sources' },
    ),
  ]
  return scoreOptimizationChecks(checks, contentState)
}
