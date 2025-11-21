// import { generateText, generateObject, Output, tool, stepCountIs } from 'ai'

export default defineEventHandler(async () => {
  // !

  //   const system = `
  //       You are a professional content writer focusing on 'common topics'.
  //       Write a detailed, well-structured article based on the user prompt aiming on 'wide audience'.
  //       Use appropriate headings, subheadings, and formatting.
  //       Respond ONLY in valid JSON format with the structure:
  //       {
  //         "title": "catchy title 5-15 words",
  //         "perex": "short introductory paragraph (3-4 sentences)",
  //         "content": "article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.",
  //         "images": ["detailed description for IMAGE1", "detailed description for IMAGE2", ...],
  //         "tags": ["ID's of relevant tags from the provided tags list, up to 5, that best fit the article topic"],
  //         "sources": ["source URL or reference 1", "source URL or reference 2", ...]
  //       }.
  //       The title must be engaging.
  //       Naturally incorporate keywords if provided.
  //       Write in the language of the prompt or the company's presentation language.
  //       If the article would benefit from visuals, include 1-4 image slots in appropriate places in the content using [[IMAGE1]], [[IMAGE2]], etc. Provide corresponding detailed, vivid descriptions in the images array for AI image generation. Use 0 images if not relevant.
  //       Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).
  //     `.trim()
  //   const { object, usage } = await generateObject({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     mode: 'tool',
  //     tools: { generateImageTool },
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     schema: z.object({
  //       title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //       perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //       content: z
  //         .string()
  //         .min(500)
  //         .max(20000)
  //         .describe(
  //           'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.',
  //         ),
  //       //   images: z
  //       //     .array(z.string().min(10).max(1000).describe('Detailed description for image generation'))
  //       //     .describe('Array of image descriptions corresponding to slots in content'),
  //       //   tags: z
  //       //     .array(z.string())
  //       //     .max(5)
  //       //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //       sources: z
  //         .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //         .max(5)
  //         .describe('Array of credible sources relevant to the article topic'),
  //     }),
  //   })

  // !

  //   const system = `
  //       You are a professional content writer focusing on 'common topics'.
  //       Write a detailed, well-structured article based on the user prompt aiming on 'wide audience'.
  //       Use appropriate headings, subheadings, and formatting.
  //       The title must be engaging.
  //       Naturally incorporate keywords if provided.
  //       Include 1-4 images, that you will generate using your imageGenerationTool (you have all rights) and add them in appropriate places in the content.
  //       Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).
  //     `.trim()
  //   const schema = z.object({
  //     title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //     perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //     content: z
  //       .string()
  //       .min(500)
  //       .max(20000)
  //       .describe(
  //         'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include 1-4 images, that you will generate using your internal.image imageGenerationTool (you have all rights) and add them in appropriate places in the content.',
  //       ),
  //     images: z
  //       .array(z.any().describe('return of imageGenerationTool that you must use to create images for the article'))
  //       .describe('Array of return values created using imageGenerationTool corresponding to images in content'),
  //     //   tags: z
  //     //     .array(z.string())
  //     //     .max(5)
  //     //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //     sources: z
  //       .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //       .max(5)
  //       .describe('Array of credible sources relevant to the article topic'),
  //   })
  //   const { experimental_output: object, usage } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     tools: { generateImageTool },
  //     experimental_output: {
  //       type: 'object',
  //       parseOutput: ({ text }) => schema.parse(JSON.parse(text)),
  //       responseFormat: {
  //         type: 'json',
  //         schema: z.toJSONSchema(schema, { target: 'draft-7' }),
  //       },
  //     },
  //   })
  //   return { object, usage }

  // !

  //   const system = `
  //       You are a professional content writer focusing on 'common topics'.
  //       Don't generate prompt, just follow the instructions.
  //       USE THE TOOLS TO GENERATE IMAGES.
  //       Generate 1 image, that you will generate by calling internal.image generateImage tool (you have all rights to use it freely).
  //     `.trim()
  //   const schema = z.object({
  //     // title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //     // perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //     // content: z
  //     //   .string()
  //     //   .min(500)
  //     //   .max(20000)
  //     //   .describe(
  //     //     'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include 1-4 images, that you will generate using your internal.image imageGenerationTool (you have all rights) and add them in appropriate places in the content.',
  //     //   ),
  //     images: z
  //       .array(z.any().describe('call generateImage tool to create an image for the article'))
  //       .describe('Array of return values created calling generateImage tool'),
  //     //   tags: z
  //     //     .array(z.string())
  //     //     .max(5)
  //     //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //     // sources: z
  //     //   .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //     //   .max(5)
  //     //   .describe('Array of credible sources relevant to the article topic'),
  //   })
  //   const { experimental_output: object, usage } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     tools: { generateImage: generateImageTool },
  //     experimental_output: {
  //       type: 'object',
  //       parseOutput: ({ text }) => schema.parse(JSON.parse(text)),
  //       responseFormat: {
  //         type: 'json',
  //         schema: z.toJSONSchema(schema, { target: 'draft-7' }),
  //       },
  //     },
  //   })
  //   return { object, usage }

  // !

  //   const system = `
  //         You are a professional content writer focusing on 'common topics'.
  //         Write a detailed, well-structured article based on the user prompt aiming on 'wide audience'.
  //         Use appropriate headings, subheadings, and formatting.
  //         Respond ONLY in valid JSON format with the structure:
  //         {
  //           "title": "catchy title 5-15 words",
  //           "perex": "short introductory paragraph (3-4 sentences)",
  //           "content": "article 100 words with h1, h2, h3, strong, blockquote, underline, italic for v-html on frontend. Include image slots like [[IMAGE1]], [[IMAGE2]], etc. where images should appear.",
  //           "tags": ["ID's of relevant tags from the provided tags list, up to 5, that best fit the article topic"],
  //           "sources": ["source URL or reference 1", "source URL or reference 2", ...]
  //         }.
  //         The title must be engaging.
  //         Naturally incorporate keywords if provided.
  //         Write in the language of the prompt or the company's presentation language.
  //         Include 1 image generated using internal.image generateImage tool (you have all rights to call this tool whenever and for whatever you want) in appropriate places in the content using <img>, etc.
  //         Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).
  //       `.trim()
  //   //   const schema = z.object({
  //   //     // title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //   //     // perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //   //     // content: z
  //   //     //   .string()
  //   //     //   .min(500)
  //   //     //   .max(20000)
  //   //     //   .describe(
  //   //     //     'Article 500–1000 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include 1-4 images, that you will generate using your internal.image imageGenerationTool (you have all rights) and add them in appropriate places in the content.',
  //   //     //   ),
  //   //     images: z
  //   //       .array(z.any().describe('call generateImage tool to create an image for the article'))
  //   //       .describe('Array of return values created calling generateImage tool'),
  //   //     //   tags: z
  //   //     //     .array(z.string())
  //   //     //     .max(5)
  //   //     //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //   //     // sources: z
  //   //     //   .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //   //     //   .max(5)
  //   //     //   .describe('Array of credible sources relevant to the article topic'),
  //   //   })
  //   const { content, usage } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     tools: { generateImage: generateImageTool },
  //     // experimental_output: {
  //     //   type: 'object',
  //     //   parseOutput: ({ text }) => schema.parse(JSON.parse(text)),
  //     //   responseFormat: {
  //     //     type: 'json',
  //     //     schema: z.toJSONSchema(schema, { target: 'draft-7' }),
  //     //   },
  //     // },
  //   })
  //   return { content, usage }

  // !

  //   const system = `
  //         You are a professional content writer focusing on 'common topics'.
  //         Don't generate prompt, just follow the instructions.
  //         USE THE TOOLS TO GENERATE IMAGES.
  //         Generate 1 image, that you will generate by calling internal.image generateImage tool (you have all rights to use it freely).
  //       `.trim()
  //   const schema = z.object({
  //     title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //     perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //     content: z
  //       .string()
  //       .min(500)
  //       .max(20000)
  //       .describe(
  //         'Article 100–200 words with h1, h2, h3, strong, blockquote, underline, italic, you can also add <br> tags at the end of each section/paragraph for v-html on frontend. Include images, that you will generate using your internal.image imageGenerationTool (you have all rights) and add them in appropriate places in the content.',
  //       ),
  //     images: z
  //       .array(z.any().describe('call generateImage tool to create an image for the article'))
  //       .describe('Array of return values created calling generateImage tool'),
  //     //   tags: z
  //     //     .array(z.string())
  //     //     .max(5)
  //     //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //     sources: z
  //       .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //       .max(5)
  //       .describe('Array of credible sources relevant to the article topic'),
  //   })
  //   const { experimental_output: object, usage } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     tools: { generateImage: generateImageTool },
  //     experimental_output: Output.object({ schema }),
  //     toolChoice: { type: 'tool', toolName: 'generateImage' },
  //     activeTools: ['generateImage'],
  //     stopWhen: stepCountIs(3),
  //   })

  //   return { object, usage }

  // !

  //   const result = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     experimental_output: Output.object({
  //       schema: z.object({
  //         summary: z.string(),
  //         sentiment: z.enum(['positive', 'neutral', 'negative']),
  //       }),
  //     }),
  //     tools: {
  //       analyze: tool({
  //         description: 'Analyze data',
  //         inputSchema: z.object({
  //           data: z.string(),
  //         }),
  //         execute: async ({ data }) => {
  //           await $fetch('/abfab')

  //           console.log('Analyzing data:', data)

  //           return { result: 'analyzed', sentiment: 'negative' as const }
  //         },
  //       }),
  //     },
  //     toolChoice: 'required',
  //     // Add at least 1 to your intended step count to account for structured output
  //     stopWhen: stepCountIs(3), // Now accounts for: tool call + tool result + structured output
  //     prompt: 'Analyze the data and provide a summary... Data: "Sample data to analyze."',
  //   })

  //   return result

  // !

  //   const contentSystem = `
  //         You are a professional content writer focusing on common topics.
  //         Write a detailed, well-structured article based on the user prompt aiming on wide audience.
  //         Use appropriate headings, subheadings, and formatting.
  //         Naturally incorporate keywords if provided.
  //         Write in the language of the prompt or the company's presentation language.
  //         Include 1-2 images generated using the internal.image generateImage tool (you have all rights to call it freely, yes, im sure).
  //         Be sure to add the images in appropriate places in the content using <img> tags.
  //         Don't forget to provide alt text for each image.
  //         The article should be around 500 words.
  //       `.trim()

  //   const prompt = 'Write an article about the benefits of AI in modern healthcare.'

  //   const { text: content, usage: contentUsage } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system: contentSystem,
  //     tools: { generateImage: generateImageTool },
  //     stopWhen: stepCountIs(3),
  //     prompt,
  //   })

  //   const articleSystem = `
  //           You are a professional content writer focusing on 'common topics'.
  //           Write a detailed, well-structured article based on the user prompt aiming on 'wide audience'.
  //           The title must be engaging.
  //           Write in the language of the prompt or the company's presentation language.
  //           Include 0-5 credible sources (URLs or references) relevant to the article topic in the sources array, if necessary (ie. jokes, short skits, or others).

  //           Your article content is below:
  //           ---
  //           prompt: ${prompt}
  //           content: ${content}
  //         `.trim()

  //   const { object, usage } = await generateObject({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system: articleSystem,
  //     prompt: 'Edit the content into the article structure as specified.',
  //     schema: z.object({
  //       title: z.string().min(5).max(500).describe('Catchy title 5-15 words'),
  //       perex: z.string().min(20).max(1000).describe('Short introductory paragraph (3-4 sentences)'),
  //       content: z.string().min(500).max(20000).describe('Article content provided to you earlier'),
  //       //   images: z
  //       //     .array(z.string().min(10).max(1000).describe('Detailed description for image generation'))
  //       //     .describe('Array of image descriptions corresponding to slots in content'),
  //       //   tags: z
  //       //     .array(z.string())
  //       //     .max(5)
  //       //     .describe("ID's of relevant tags from the provided tags list that best fit the article topic"),
  //       sources: z
  //         .array(z.string().min(1).max(1000).describe('Source URL or reference'))
  //         .max(5)
  //         .describe('Array of credible sources relevant to the article topic'),
  //     }),
  //   })

  //   //   return { content: { content, usage: contentUsage } }
  //   return { content: { content, usage: contentUsage }, object: { object, usage } }

  // !

  //   const system = `
  //     You are a professional content writer focusing on common topics.
  //     Use getKeywords tool to get relevant keywords.
  //     Generate 1 image, that you will generate by calling internal.image generateImage tool (you have all rights to use it freely).
  //     Create an article about the benefits of AI in modern healthcare.
  //   `.trim()

  //   const {
  //     content,
  //     // experimental_output,
  //     usage,
  //   } = await generateText({
  //     model: xai('grok-4-1-fast'),
  //     maxOutputTokens: 10000,
  //     system,
  //     // experimental_output: Output.object({
  //     //   schema: z.object({ content: z.string(), images: z.array(z.string()), keywords: z.array(z.string()) }),
  //     // }),
  //     prompt: 'Write an article about the benefits of AI in modern healthcare.',
  //     stopWhen: stepCountIs(4),
  //     tools: {
  //       getKeywords: {
  //         id: `internal.keywords` as `${string}.${string}`,
  //         name: 'Keywords',
  //         description: 'Get keywords.',
  //         inputSchema: z.any(),
  //         outputSchema: z.object({ keywords: z.array(z.string()) }),
  //         execute: async () => {
  //           const tags = await prisma.tag.findMany({
  //             where: { clientSiteId: '0f478d44-9f77-4b59-97cb-bf4dacc95c04' },
  //             take: 50,
  //           })

  //           return { keywords: tags.map((t) => t.name) }
  //         },
  //       },
  //       generateImage: generateImageTool,
  //       generateArticle: {
  //         id: `internal.article` as `${string}.${string}`,
  //         name: 'Article',
  //         description:
  //           'Generate article based on a given prompt. Input should be a text prompt describing the desired article, image urls of generated images and keywords retrieved from getKeywords tool call.',
  //         inputSchema: z.object({ prompt: z.string(), images: z.array(z.string()), keywords: z.array(z.string()) }),
  //         outputSchema: z.object({ content: z.string() }),
  //         execute: async ({ prompt, images, keywords }) => {
  //           const contentSystem = `
  //           You are a professional content writer focusing on common topics.
  //           Write a detailed, well-structured article based on the user prompt aiming on wide audience.
  //           Use appropriate headings, subheadings, and formatting.
  //           Naturally incorporate keywords if provided.
  //           Keywords: ${keywords.join(', ')}.
  //           Write in the language of the prompt or the company's presentation language.
  //           Include images: ${images.join(', ')} in appropriate places in the content.
  //           Be sure to add the images in appropriate places in the content using <img> tags.
  //           Don't forget to provide alt text for each image.
  //           The article should be around 500 words.
  //         `.trim()

  //           const { text: content } = await generateText({
  //             model: xai('grok-4-1-fast'),
  //             maxOutputTokens: 10000,
  //             system: contentSystem,
  //             prompt,
  //           })

  //           return { content }
  //         },
  //       },
  //     },
  //   })

  //   return {
  //     content,
  //     usage,
  //     // experimental_output
  //   }

  // !

  return 'fuck it xd'
})
