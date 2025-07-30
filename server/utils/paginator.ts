import type { H3Event } from 'h3'

interface Pagination {
  page: number
  limit: number
  skip: number
  take: number
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const getPagination = async (event: H3Event): Promise<Pagination> => {
  const query = await getValidatedQuery(event, paginationSchema.parse)
  const page = query.page ?? 1
  const limit = query.limit ?? 10
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  }
}
