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

const errorResponses = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '429': { $ref: '#/components/responses/RateLimited' },
  '500': { $ref: '#/components/responses/ServerError' },
}

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Topiqu External API',
    version: '1.0.0',
    description:
      'Read-only API for retrieving published Topiqu articles. Clients must ignore unknown response fields so v1 can evolve compatibly.',
    contact: { name: 'Topiqu support', url: 'https://topiqu.com' },
  },
  servers: [{ url: 'https://app.topiqu.com/api/v1', description: 'Production' }],
  tags: [{ name: 'Articles', description: 'Published article content belonging to the authenticated site.' }],
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/articles': {
      get: {
        operationId: 'listArticles',
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
    },
    '/articles/{id}': {
      get: {
        operationId: 'getArticle',
        summary: 'Get a published article',
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
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Site API key created in Topiqu settings.',
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
        ['NotFound', 404, 'Article not found'],
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
