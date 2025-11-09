import mjml2html from 'mjml'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const lang = (getCookie(event, 'i18n_lang') as Language | undefined) ?? 'en'
  const templateId = 'newComment'

  const article = await prisma.article.findUnique({
    where: { id: '48b3533e-2773-4b23-b521-decc66c92135' },
    select: {
      clientSiteId: true,
      id: true,
      allowedComments: true,
      userId: true,
      slug: true,
      title: true,
      user: { select: { email: true, allowEmail: true } },
    },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const base = useRuntimeConfig().public.baseUrl
  const commentUrl = (id: string) => `${base}/clanky/${article.slug}#comment-${id}`
  const replyUrl = `${base}/clanky/${article.slug}/reply`
  const logoUrl = 'https://via.placeholder.com/150x50'

  const data = {
    userName: user.name,
    articleTitle: article.title,
    text: `${user.name}: "${'Můj obsah'.slice(0, 50)}...".\n${commentUrl('123')}`,
    commentContent: 'Můj obsah'.slice(0, 50) + '...',
    commentUrl: commentUrl('123'),
    replyUrl,
    avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
    logoUrl,
    unsubscribeUrl: `${base}/unsubscribe?email=${encodeURIComponent(article.user.email)}`,
  }

  const messages = await useStorage('assets:emails:locales').getItem(`${lang}.json`)
  if (!messages) throw createError(`Email locale messages for "en" not found`)

  const template = await useStorage('assets:emails:templates').getItem(`${templateId}.mjml`)
  if (!template) throw createError(`Email template "newComment" not found`)

  const translate = (key: string, params?: Record<string, string>): string => {
    const path = key.split('.')
    let value: any = messages
    for (const segment of path) {
      value = value?.[segment]
      if (value === undefined) break
    }

    const str = typeof value === 'string' ? value : ''
    if (!str) return key

    return params ? str.replace(/{(\w+)}/g, (_, k) => params[k] ?? `{${k}}`) : str
  }

  let rendered = template.toString()
  for (const [k, v] of Object.entries(data)) rendered = rendered.replace(new RegExp(`{\\s*${k}\\s*}`, 'g'), v)

  rendered = rendered.replace(/\{t:([^}]+)\}/g, (_, key: string) => translate(key, data))

  const { html, errors } = mjml2html(rendered)
  if (errors.length) throw createError('MJML compilation failed')

  return html
})
