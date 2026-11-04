export default defineEventHandler(async (event) =>
  updateArticle(event, getRouterParam(event, 'id'), await readBody(event)),
)
