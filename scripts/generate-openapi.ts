import { dirname, resolve } from 'node:path'
import { format, resolveConfig } from 'prettier'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const outputPath = resolve(import.meta.dir, '../openapi/v1.json')

const nullableString = { type: ['string', 'null'] }
const dateTime = { type: 'string', format: 'date-time' }

const tag = {
  type: 'object',
  required: ['id', 'name', 'slug'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
  },
}

const translation = {
  type: 'object',
  required: ['id', 'language', 'slug', 'title', 'excerpt', 'translatedAt'],
  properties: {
    id: { type: 'string' },
    language: { type: 'string', example: 'en' },
    slug: nullableString,
    title: nullableString,
    excerpt: nullableString,
    translatedAt: { oneOf: [dateTime, { type: 'null' }] },
  },
}

const articleProperties = {
  id: { type: 'string', example: 'cm123abc' },
  title: { type: 'string', example: 'How AI changes content operations' },
  slug: { type: 'string', example: 'how-ai-changes-content-operations' },
  excerpt: nullableString,
  imageUrl: { ...nullableString, format: 'uri' },
  aiInvolvement: { type: 'string', description: 'Level of AI involvement declared by the publisher.' },
  readingTime: { type: ['integer', 'null'], minimum: 0 },
  totalWords: { type: ['integer', 'null'], minimum: 0 },
  createdAt: dateTime,
  updatedAt: dateTime,
  publishedAt: { oneOf: [dateTime, { type: 'null' }] },
  language: { type: 'string', example: 'cs' },
  tags: { type: 'array', items: tag },
  user: {
    type: 'object',
    required: ['id', 'username', 'avatarUrl'],
    properties: { id: { type: 'string' }, username: { type: 'string' }, avatarUrl: nullableString },
  },
  articleSeries: {
    oneOf: [
      {
        type: 'object',
        required: ['id', 'name', 'slug'],
        properties: { id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' } },
      },
      { type: 'null' },
    ],
  },
  availableTranslations: { type: 'array', items: translation },
}

// `apiKey` security schemes cannot carry scopes in OpenAPI, so operations state them in vendor extensions.
const apiKeyScopes = {
  READ: 'Published articles, tags and site details. Every key has it.',
  WRITE: 'Create and edit drafts; read drafts.',
  PUBLISH: 'Publish, unpublish and schedule articles.',
  GENERATE: 'Request AI-written articles; uses article credits.',
}
const publishScope = {
  scope: 'PUBLISH',
  when: 'The request sets `status` or `releaseAt` (creating a draft needs only WRITE).',
}

const errorResponses = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '429': { $ref: '#/components/responses/RateLimited' },
  '500': { $ref: '#/components/responses/ServerError' },
}

const idempotencyKey = (required: boolean) => ({
  name: 'Idempotency-Key',
  in: 'header',
  required,
  description:
    'A unique value per logical request. Completed responses replay for 24 hours with `Idempotent-Replayed: true`. Running or uncertain operations return 409 and retain their claim; do not retry them with a new key. Known client rejections, including 402, may be retried after correction or funding.',
  schema: { type: 'string', maxLength: 255 },
})

const writeErrors = {
  '404': { $ref: '#/components/responses/NotFound' },
  '409': { $ref: '#/components/responses/Conflict' },
  '422': { $ref: '#/components/responses/IdempotencyMismatch' },
}

const tagSlugs = {
  type: 'array',
  maxItems: 30,
  items: { type: 'string', maxLength: 64 },
  description: 'Slugs of existing tags of the site. The list replaces the article tags.',
}
const mediaRightsReview = {
  type: 'object',
  required: ['fingerprint', 'acknowledged'],
  properties: { fingerprint: { type: 'string' }, acknowledged: { const: true } },
  description:
    'Send it back after a 409 `MEDIA_RIGHTS_REVIEW_REQUIRED` to confirm the media rights the response listed (its `data.report.fingerprint`).',
}
const writableArticle = {
  title: { type: 'string', minLength: 1, maxLength: 255 },
  content: { type: 'string', maxLength: 500000, description: 'HTML. It is sanitized like editor content.' },
  excerpt: nullableString,
  slug: { type: 'string', maxLength: 100, description: 'Normalized; derived from the title when omitted.' },
  tags: tagSlugs,
  status: { type: 'string', enum: ['draft', 'published'], description: 'Needs the PUBLISH scope.' },
  releaseAt: {
    oneOf: [dateTime, { type: 'null' }],
    description: 'Schedules publication; needs the PUBLISH scope.',
  },
  allowedComments: { type: 'boolean' },
  mediaRightsReview,
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Topiqu External API',
    version: '1.0.0',
    description:
      'API for reading published Topiqu articles and, with write scopes, creating, editing, publishing and generating them. Each key has scopes (READ, WRITE, PUBLISH, GENERATE) and acts for the member who created it, never with more rights than that member has. Requests are limited to 120 per minute per key. Clients must ignore unknown response fields so v1 can evolve compatibly.',
    contact: { name: 'Topiqu support', url: 'https://topiqu.com' },
  },
  servers: [{ url: 'https://app.topiqu.com/api/v1', description: 'Production' }],
  tags: [
    { name: 'Articles', description: 'Article content belonging to the authenticated site.' },
    { name: 'Generations', description: 'Articles written by Topiqu on request. Each one uses article credits.' },
  ],
  security: [{ ApiKeyAuth: [] }],
  'x-api-key-scopes': apiKeyScopes,
  paths: {
    '/articles': {
      get: {
        operationId: 'listArticles',
        'x-required-scopes': ['READ'],
        summary: 'List published articles',
        description: 'Returns published articles newest first. Multiple tag slugs use AND semantics.',
        tags: ['Articles'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          {
            name: 'tag',
            in: 'query',
            description: 'Comma-separated tag slugs.',
            schema: { type: 'string' },
            example: 'ai,marketing',
          },
        ],
        responses: {
          '200': {
            description: 'A page of published articles.',
            headers: { 'X-API-Version': { schema: { type: 'string' }, description: 'Resolved major API version.' } },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ArticleListResponse' } } },
          },
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createArticle',
        'x-required-scopes': ['WRITE'],
        'x-conditional-scopes': [publishScope],
        summary: 'Create an article',
        description:
          'Needs the WRITE scope; publishing or scheduling also PUBLISH. The article is authored by the member who created the key.',
        tags: ['Articles'],
        parameters: [idempotencyKey(false)],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ArticleCreate' } } },
        },
        responses: {
          '201': {
            description: 'The created article.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnedArticleResponse' } } },
          },
          ...writeErrors,
          ...errorResponses,
        },
      },
    },
    '/articles/{id}': {
      get: {
        operationId: 'getArticle',
        'x-required-scopes': ['READ'],
        summary: 'Get an article',
        description:
          'Published articles for any key. A key with the WRITE scope also reads drafts and gets `status`, `editVersion` and `releaseAt`.',
        tags: ['Articles'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'The published article.',
            headers: { 'X-API-Version': { schema: { type: 'string' } } },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ArticleResponse' } } },
          },
          '404': { $ref: '#/components/responses/NotFound' },
          ...errorResponses,
        },
      },
      patch: {
        operationId: 'updateArticle',
        'x-required-scopes': ['WRITE'],
        'x-conditional-scopes': [publishScope],
        summary: 'Update an article',
        description:
          'Needs the WRITE scope; changing `status` or `releaseAt` also PUBLISH. Send `expectedVersion` (the `editVersion` you read) to get a 409 instead of overwriting a newer edit; without it the update is last-write-wins.',
        tags: ['Articles'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, idempotencyKey(false)],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ArticleUpdate' } } },
        },
        responses: {
          '200': {
            description: 'The updated article.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnedArticleResponse' } } },
          },
          ...writeErrors,
          ...errorResponses,
        },
      },
    },
    '/articles/generate': {
      post: {
        operationId: 'generateArticle',
        'x-required-scopes': ['GENERATE'],
        summary: 'Request an AI-written article',
        description:
          'Needs the GENERATE scope. Queues the article and returns at once; Topiqu researches and writes it as a draft, then sends the `generation.succeeded` or `generation.failed` webhook. Uses the article credits of one article at the site quality. At most 5 requests can be queued or running per site.',
        tags: ['Generations'],
        parameters: [idempotencyKey(true)],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerationRequest' } } },
        },
        responses: {
          '202': {
            description: 'The queued request.',
            headers: { Location: { schema: { type: 'string' }, description: 'Status URL of the request.' } },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerationResponse' } } },
          },
          '402': { $ref: '#/components/responses/InsufficientCredits' },
          ...writeErrors,
          ...errorResponses,
        },
      },
    },
    '/generations/{id}': {
      get: {
        operationId: 'getGeneration',
        'x-required-scopes': ['GENERATE'],
        summary: 'Get a generation request',
        description: 'Needs the GENERATE scope.',
        tags: ['Generations'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'The request and, once written, its draft article ID.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerationResponse' } } },
          },
          '404': { $ref: '#/components/responses/NotFound' },
          ...errorResponses,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description:
          'API key created in Topiqu settings (Integrations). It is shown once; Topiqu stores only its SHA-256 hash.',
      },
    },
    schemas: {
      ArticleSummary: {
        type: 'object',
        required: Object.keys(articleProperties),
        properties: articleProperties,
      },
      Article: {
        allOf: [
          { $ref: '#/components/schemas/ArticleSummary' },
          {
            type: 'object',
            required: ['content', 'imageCredit', 'sources', 'allowedComments'],
            properties: {
              content: { type: 'string', description: 'Article body as sanitized HTML.' },
              imageCredit: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
              sources: { type: 'array', items: { type: 'string' } },
              allowedComments: { type: 'boolean' },
            },
          },
        ],
      },
      PaginationMeta: {
        type: 'object',
        required: ['total', 'page', 'limit', 'primaryLanguage', 'appliedFilters'],
        properties: {
          total: { type: 'integer', minimum: 0 },
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          primaryLanguage: { type: 'string' },
          appliedFilters: {
            type: 'object',
            required: ['tags'],
            properties: { tags: { type: 'array', items: { type: 'string' } } },
          },
        },
      },
      ArticleListResponse: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/ArticleSummary' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      ArticleResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: '#/components/schemas/Article' } },
      },
      OwnedArticle: {
        allOf: [
          { $ref: '#/components/schemas/Article' },
          {
            type: 'object',
            required: ['status', 'editVersion', 'releaseAt'],
            properties: {
              status: { type: 'string', enum: ['draft', 'published', 'archived'] },
              editVersion: { type: 'integer', minimum: 0 },
              releaseAt: { oneOf: [dateTime, { type: 'null' }] },
            },
          },
        ],
      },
      OwnedArticleResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: '#/components/schemas/OwnedArticle' } },
      },
      ArticleCreate: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: {
          ...writableArticle,
          language: { type: 'string', description: 'Content language; the site language when omitted.' },
        },
      },
      ArticleUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { ...writableArticle, expectedVersion: { type: 'integer', minimum: 0 } },
      },
      GenerationRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['topic'],
        properties: {
          topic: { type: 'string', minLength: 3, maxLength: 500, description: 'The subject to write about.' },
          instructions: {
            type: 'string',
            maxLength: 2000,
            description: 'Editorial preferences, e.g. audience or angle. They never override Topiqu quality rules.',
          },
        },
      },
      Generation: {
        type: 'object',
        required: ['id', 'topic', 'status', 'articleId', 'error', 'createdAt', 'startedAt', 'finishedAt'],
        properties: {
          id: { type: 'string' },
          topic: { type: 'string' },
          status: { type: 'string', enum: ['queued', 'running', 'succeeded', 'failed'] },
          articleId: { ...nullableString, description: 'The draft article once the request succeeded.' },
          error: nullableString,
          createdAt: dateTime,
          startedAt: { oneOf: [dateTime, { type: 'null' }] },
          finishedAt: { oneOf: [dateTime, { type: 'null' }] },
        },
      },
      GenerationResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: '#/components/schemas/Generation' } },
      },
      Error: {
        type: 'object',
        required: ['statusCode', 'message'],
        properties: { statusCode: { type: 'integer' }, message: { type: 'string' } },
      },
    },
    responses: Object.fromEntries(
      [
        ['BadRequest', 400, 'Invalid request'],
        ['Unauthorized', 401, 'Missing or invalid API key'],
        ['InsufficientCredits', 402, 'Insufficient article credits'],
        ['Forbidden', 403, 'The key or its member lacks the required scope'],
        ['NotFound', 404, 'Not found'],
        [
          'Conflict',
          409,
          'Edit conflict, media rights review required, or the same Idempotency-Key is running or uncertain',
        ],
        ['IdempotencyMismatch', 422, 'The Idempotency-Key was used for a different request'],
        ['RateLimited', 429, 'Rate limit exceeded'],
        ['ServerError', 500, 'Unexpected server error'],
      ].map(([name, statusCode, description]) => [
        name,
        {
          description,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { statusCode, message: description },
            },
          },
        },
      ]),
    ),
  },
}

const serialized = await format(JSON.stringify(document), {
  ...(await resolveConfig(outputPath)),
  filepath: outputPath,
})

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== serialized) {
    console.error('openapi/v1.json is stale. Run: bun run openapi:generate')
    process.exit(1)
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serialized)
  console.log(`Generated ${outputPath}`)
}
