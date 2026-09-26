import { KNOWLEDGE_LIMITS, type KnowledgeFileExtension } from '~~/shared/utils/knowledge'

import { extractReadableSource } from '../factCheckSources'
import { fetchPublicUrl, readLimitedBody } from '../images/publicFetch'

export type KnowledgeExtractErrorCode = 'unsupported' | 'empty' | 'tooLarge' | 'unreachable'

export class KnowledgeExtractError extends Error {
  constructor(readonly code: KnowledgeExtractErrorCode) {
    super(`Knowledge extraction failed: ${code}`)
  }
}

export type ExtractedKnowledge = { title: string | null; content: string; mimeType: string; validAsOf?: Date | null }

/** PDF dates look like `D:20240131120000+01'00'`; HTML ones are ISO. Anything unparseable or future is dropped. */
export const parseDocumentDate = (value: unknown) => {
  if (typeof value !== 'string') return null
  const pdf = value.match(/^D:(\d{4})(\d{2})?(\d{2})?/)
  const date = pdf ? new Date(Date.UTC(Number(pdf[1]), Number(pdf[2] ?? 1) - 1, Number(pdf[3] ?? 1))) : new Date(value)
  return Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86_400_000 ? null : date
}

const MIME: Record<KnowledgeFileExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, index) => bytes[index] === byte)

/** The extension is only a hint: the bytes must agree with it, so a renamed binary never reaches a parser. */
export const detectKnowledgeFormat = (bytes: Uint8Array, filename: string): KnowledgeFileExtension | null => {
  const extension = filename.split('.').pop()?.toLowerCase()
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return extension === 'pdf' ? 'pdf' : null
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return extension === 'docx' ? 'docx' : null
  if (extension !== 'txt' && extension !== 'md') return null
  return bytes.includes(0) ? null : extension
}

export const normalizeKnowledgeText = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const finish = (
  title: string | null | undefined,
  raw: string,
  mimeType: string,
  validAsOf: Date | null = null,
): ExtractedKnowledge => {
  const content = normalizeKnowledgeText(raw)
  if (content.length < 40) throw new KnowledgeExtractError('empty')
  if (content.length > KNOWLEDGE_LIMITS.maxSourceCharacters) throw new KnowledgeExtractError('tooLarge')
  return { title: title?.trim().slice(0, 200) || null, content, mimeType, validAsOf }
}

const htmlText = (html: string) => extractReadableSource(html, { headings: true, maxCharacters: Infinity })

const extractPdf = async (bytes: Uint8Array) => {
  const { getDocumentProxy, extractText, getMeta } = await import('unpdf')
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const [{ text }, meta] = await Promise.all([extractText(pdf, { mergePages: true }), getMeta(pdf)])
    const info = meta.info as { Title?: string; ModDate?: string; CreationDate?: string } | undefined
    return finish(info?.Title, text, MIME.pdf, parseDocumentDate(info?.ModDate) ?? parseDocumentDate(info?.CreationDate))
  } catch (error) {
    if (error instanceof KnowledgeExtractError) throw error
    throw new KnowledgeExtractError('unsupported')
  }
}

const extractDocx = async (bytes: Uint8Array) => {
  const { default: mammoth } = await import('mammoth')
  try {
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })
    return finish(null, htmlText(value).content, MIME.docx)
  } catch (error) {
    if (error instanceof KnowledgeExtractError) throw error
    throw new KnowledgeExtractError('unsupported')
  }
}

const decodeUtf8 = (bytes: Uint8Array) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new KnowledgeExtractError('unsupported')
  }
}

export const extractKnowledgeFile = async (bytes: Uint8Array, filename: string) => {
  if (bytes.byteLength > KNOWLEDGE_LIMITS.maxFileBytes) throw new KnowledgeExtractError('tooLarge')
  const format = detectKnowledgeFormat(bytes, filename)
  if (format === 'pdf') return extractPdf(bytes)
  if (format === 'docx') return extractDocx(bytes)
  if (format) return finish(null, decodeUtf8(bytes), MIME[format])
  throw new KnowledgeExtractError('unsupported')
}

export const extractKnowledgeUrl = async (url: string) => {
  let response: Response
  try {
    response = await fetchPublicUrl(url, 10_000)
  } catch {
    throw new KnowledgeExtractError('unreachable')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new KnowledgeExtractError('unreachable')
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const bytes = await readLimitedBody(response, KNOWLEDGE_LIMITS.maxFileBytes).catch(() => {
    throw new KnowledgeExtractError('tooLarge')
  })
  if (contentType.includes('application/pdf')) return extractPdf(bytes)
  if (contentType.includes('text/html')) {
    const { title, content, publishedAt } = htmlText(decodeUtf8(bytes))
    return finish(title, content, 'text/html', parseDocumentDate(publishedAt))
  }
  if (contentType.includes('text/plain') || contentType.includes('text/markdown'))
    return finish(null, decodeUtf8(bytes), contentType.split(';')[0]!)
  throw new KnowledgeExtractError('unsupported')
}
