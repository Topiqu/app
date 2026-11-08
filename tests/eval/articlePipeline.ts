import { vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

/** The real article pipeline (research → writer → review → revision) with its Nitro auto-imports wired up. */
export async function stubArticlePipeline() {
  // The spend cap reserves in the database, which an eval does not have.
  vi.stubGlobal('aiLanguageSpend', () => ({}))
  await stubNitroImports(import('../../server/utils/aiUsage'), 'recordAiUsage')
  await stubNitroImports(import('../../server/utils/ai/articleUsage'), 'withArticleUsageStage')
  await stubNitroImports(import('../../server/utils/ai/articleUsage'), 'articleLanguageUsage')
  await stubNitroImports(
    import('../../server/utils/ai/modelRegistry'),
    'aiModelId',
    'aiModelProvider',
    'articleWriterId',
  )
  await stubNitroImports(import('../../server/utils/images/verify'), 'imageDepicts')
  await stubNitroImports(import('../../server/utils/ai/formats'), 'applyFormat', 'formatRules', 'selectedModulesFor')
  await stubNitroImports(import('../../server/utils/sanitize'), 'escapeHtml')
  await stubNitroImports(import('../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../server/utils/ai/articleLinks'), 'linkArticle')
  await stubNitroImports(
    import('../../server/utils/images/selection'),
    'createImageSelection',
    'photoSubjectQuery',
    'matchesImageQuery',
  )
  await stubNitroImports(import('../../server/utils/images/http'), 'fetchJson', 'imageApiHeaders')
  await stubNitroImports(import('../../server/utils/images/openverse'), 'openverse')
  await stubNitroImports(import('../../server/utils/images/wikimedia'), 'wikimedia')
  await stubNitroImports(import('../../server/utils/images/chain'), 'findStockImage')
  await stubNitroImports(
    import('../../server/utils/images/stores'),
    'storeMediaSource',
    'matchesStoreTitle',
    'storeSearchTerm',
  )
  await stubNitroImports(import('../../server/utils/images/steam'), 'createSteamImageSearch')
  await stubNitroImports(import('../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../server/utils/articleGenerationAudit'), 'auditArticleStep')
  await stubNitroImports(import('../../server/utils/images/appStore'), 'createAppStoreImageSearch')
  await stubNitroImports(import('../../server/utils/images/caption'), 'buildImageHtml')
  await stubNitroImports(import('../../server/utils/storage'), 'putToCdn')
  await stubNitroImports(import('../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
  await stubNitroImports(
    import('../../server/utils/images/optimize'),
    'optimizeGeneratedImage',
    'IMMUTABLE_IMAGE_CACHE_CONTROL',
  )
  await stubNitroImports(
    import('../../server/utils/images/press'),
    'findPressImage',
    'loadPressImages',
    'youtubeThumbnailImage',
  )
  await stubNitroImports(import('../../server/utils/ai/articleMedia'), 'finalizeArticle')
  await stubNitroImports(
    import('../../server/utils/ai/researchEvidence'),
    'filterResearchSources',
    'researchTopic',
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
  await stubNitroImports(
    import('../../server/utils/ai/editorialPolicy'),
    'editorialPolicy',
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(import('../../server/utils/ai/insight'), 'insightSchema')
  await stubNitroImports(import('../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../server/utils/community'), 'readCommunityInsight')
  await stubNitroImports(
    import('../../server/utils/ai/articleQuality'),
    'buildRevisionPrompt',
    'buildEditPrompt',
    'buildRemovalPrompt',
    'revisionEditsSchema',
    'applyRevisionEdits',
    'isRemovable',
    'reviewArticle',
    'recheckRevision',
    'revisionEvidence',
    'AUTHOR_ACCOUNT_RULE',
    'SOURCE_CONFLICT_RULE',
  )
  await stubNitroImports(import('../../server/utils/knowledge/retrieve'), 'retrieveKnowledge')
  await stubNitroImports(import('../../server/utils/ai/articleConfig'), 'buildArticleConfig')
}
