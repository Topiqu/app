import { join } from 'path'
import mjml2html from 'mjml'
import { readFile } from 'fs/promises'

interface EmailData {
  to: string
  subject: string
  text: string
  template: string
  data: Record<string, string>
}

export async function sendEmail({ to, subject, text, template, data }: EmailData) {
  const templatePath = join(process.cwd(), 'emails', 'templates', `${template}.mjml`)
  let mjmlTemplate = await readFile(templatePath, 'utf-8')

  for (const [key, value] of Object.entries(data)) {
    mjmlTemplate = mjmlTemplate.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), sanitizeHtml(value))
  }

  const { html, errors } = mjml2html(mjmlTemplate)
  if (errors.length) throw new Error(`MJML errors: ${JSON.stringify(errors)}`)

  await useNodeMailer().sendMail({
    from: useRuntimeConfig().from,
    to,
    subject,
    text,
    html,
  })
}
