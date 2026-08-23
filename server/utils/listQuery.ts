import { z } from 'zod'
import { createError } from 'h3'

const dateValue = z.string().date().optional()
const order = z.enum(['asc', 'desc']).default('desc')

const normalize = (input: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]))

export const articleListQuerySchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    dateFrom: dateValue,
    dateTo: dateValue,
    sort: z.enum(['title', 'status', 'createdAt']).default('createdAt'),
    order,
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'dateFrom must not be after dateTo',
    path: ['dateTo'],
  })

export const clientListQuerySchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    name: z.string().trim().max(200).optional(),
    domain: z.string().trim().max(253).optional(),
    plan: z.enum(['BASIC', 'PRO', 'PREMIUM', 'CUSTOM']).optional(),
    status: z.enum(['active', 'deactivated']).optional(),
    dateFrom: dateValue,
    dateTo: dateValue,
    sort: z.enum(['name', 'domain', 'plan', 'createdAt']).default('createdAt'),
    order,
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'dateFrom must not be after dateTo',
    path: ['dateTo'],
  })

const parseQuery = <T>(schema: z.ZodType<T>, input: Record<string, unknown>): T => {
  const result = schema.safeParse(normalize(input))
  if (result.success) return result.data
  throw createError({ statusCode: 400, message: result.error.issues[0]?.message || 'Invalid query parameters' })
}

export const parseArticleListQuery = (input: Record<string, unknown>) => parseQuery(articleListQuerySchema, input)
export const parseClientListQuery = (input: Record<string, unknown>) => parseQuery(clientListQuerySchema, input)

export const dateRangeWhere = (dateFrom?: string, dateTo?: string) =>
  dateFrom || dateTo
    ? {
        ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
        ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
      }
    : undefined
