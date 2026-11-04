export default defineEventHandler(async (event) => createArticle(event, await readBody(event)))
