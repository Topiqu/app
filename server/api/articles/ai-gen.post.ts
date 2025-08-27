import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

export default defineLazyEventHandler(() => {
  const apiKey = useRuntimeConfig().openAI
  const OpenAI = createOpenAI(apiKey)
  const schema = z.object({ prompt: z.string().nonempty('Prompt is required') })

  return defineEventHandler(async (event) => {
    const user = (await getServerSession(event))?.user
    if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const { prompt } = await readValidatedBody(event, schema.parse)
    const {
      tokenRemaining: maxOutputTokens,
      focus,
      keywords,
      audience,
    } = await prisma.clientSite.findFirstOrThrow({
      select: { tokenRemaining: true, focus: true, keywords: true, audience: true },
      where: { id: user.clientSiteId },
    })
    if (!maxOutputTokens || maxOutputTokens < 0)
      throw createError({ statusCode: 403, statusMessage: 'Insufficient tokens' })
    const system = `Jsi autor článku na blogu firmy zaměřené na ${focus || 'obecná témata'}. 
    Píšeš stylem poutavým a profesionálním. 
    Klíčová slova: ${JSON.stringify(keywords) || 'žádná'}. 
    Napiš článek (500–1000 slov) na téma spojené s těmito klíčovými slovy, cílený na ${audience || 'širokou veřejnost'}. 
    Použij h1, h2, h3, strong, blockquote, pro v-html na frontendu. 
    Titulek (5–15 slov) musí být poutavý, obsahovat alespoň 2 klíčová slova. 
    Klíčová slova použij párkrát v textu, i nepřímo, a s ohledem na kontext.
    Uživatelský prompt: ${prompt}`
    console.log(system)

    const { text, usage } = await generateText({ model: OpenAI('gpt-3.5-turbo'), maxOutputTokens, system, prompt })

    await prisma.clientSite.update({
      data: { tokenRemaining: { decrement: usage.totalTokens } },
      where: { id: user.clientSiteId },
    })

    return text
  })
})
