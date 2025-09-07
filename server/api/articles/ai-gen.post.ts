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
    Napiš JSON odpověď se strukturou:
    {
      "perex": "krátký odstavec (3-4 věty) jako úvod",
      "content": "článek 500–1000 slov s h1, h2, h3, strong, blockquote, underline, italic pro v-html na frontendu"
    }
    Titulek (5–15 slov) musí být poutavý.
    Klíčová slova použij přirozeně.
    Uživatelský prompt: ${prompt}.
    Odpověz POUZE validním JSONem, bez komentářů.`
    console.log(system)
    const { text, usage } = await generateText({
      model: OpenAI('gpt-3.5-turbo'),
      maxOutputTokens,
      system,
      prompt,
    })

    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'Invalid AI response' })
    }

    await prisma.clientSite.update({
      data: { tokenRemaining: { decrement: usage.totalTokens } },
      where: { id: user.clientSiteId },
    })

    await logAction({
      action: 'GENERATE_ARTICLE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      metadata: { system, text },
      ip: getIp(event),
    })

    return json
  })
})
