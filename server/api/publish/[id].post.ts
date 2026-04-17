import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing draft ID' })

  try {
    const result = await publishDecisionAndExecute(id)
    return { success: true, ...result }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
