import type { H3Event } from 'h3'

const API_BASE = 'https://api.giphy.com/v1/gifs'

export default defineEventHandler(async (event: H3Event) => {
  const action = getQuery(event).action as string | undefined
  if (action === 'list-categories') {
    const url = `${API_BASE}/categories?api_key=${process.env.GIPHY_API_KEY}`
    try {
      const res = await $fetch(url)
      return res
    } catch {
      throw createError({ statusCode: 500, message: 'Failed to fetch categories' })
    }
  }

  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

  const endpoint = query ? 'search' : 'trending'
  const url = `${API_BASE}/${endpoint}?api_key=${process.env.GIPHY_API_KEY}&limit=${take}&offset=${skip}${query ? `&q=${encodeURIComponent(query)}` : ''}`

  try {
    const res = await $fetch(url)
    return res
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to fetch GIFs' })
  }
})
