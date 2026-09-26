// @vitest-environment node
import PDFDocument from 'pdfkit'
import { describe, expect, it } from 'vitest'

import {
  detectKnowledgeFormat,
  extractKnowledgeFile,
  KnowledgeExtractError,
  normalizeKnowledgeText,
  parseDocumentDate,
} from '../../../server/utils/knowledge/extract'

const bytes = (text: string) => new TextEncoder().encode(text)

const pdf = (text: string) =>
  new Promise<Uint8Array>((resolve) => {
    const doc = new PDFDocument({ info: { Title: 'Pricing sheet' } })
    const parts: Buffer[] = []
    doc.on('data', (part: Buffer) => parts.push(part))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(parts))))
    doc.text(text)
    doc.end()
  })

describe('knowledge extraction', () => {
  it('requires the bytes to agree with the extension', () => {
    expect(detectKnowledgeFormat(bytes('%PDF-1.7'), 'a.pdf')).toBe('pdf')
    expect(detectKnowledgeFormat(bytes('%PDF-1.7'), 'a.txt')).toBeNull()
    expect(detectKnowledgeFormat(new Uint8Array([0x50, 0x4b, 3, 4]), 'a.docx')).toBe('docx')
    expect(detectKnowledgeFormat(new Uint8Array([0x50, 0x4b, 3, 4]), 'a.md')).toBeNull()
    expect(detectKnowledgeFormat(new Uint8Array([0x4d, 0x5a, 0]), 'a.txt')).toBeNull()
    expect(detectKnowledgeFormat(bytes('# Notes'), 'notes.md')).toBe('md')
    expect(detectKnowledgeFormat(bytes('plain'), 'script.sh')).toBeNull()
  })

  it('normalizes whitespace without flattening paragraphs', () => {
    expect(normalizeKnowledgeText('A\r\n\r\n\r\n\tB   c \n  d')).toBe('A\n\nB c\nd')
  })

  it('extracts markdown text and rejects near-empty files', async () => {
    const text = '# Topiqu\nCustomers usually migrate from a manual WordPress workflow.'
    await expect(extractKnowledgeFile(bytes(text), 'notes.md')).resolves.toMatchObject({
      content: text,
      mimeType: 'text/markdown',
    })
    await expect(extractKnowledgeFile(bytes('tiny'), 'notes.txt')).rejects.toMatchObject({ code: 'empty' })
  })

  it('reads text and title from a real PDF', async () => {
    const result = await extractKnowledgeFile(
      await pdf('Approval takes two to three hours every week for our customers.'),
      'sheet.pdf',
    )
    expect(result.title).toBe('Pricing sheet')
    expect(result.content).toContain('Approval takes two to three hours')
  })

  it('reports an unreadable PDF as unsupported rather than crashing', async () => {
    await expect(extractKnowledgeFile(bytes('%PDF-1.7 garbage'), 'broken.pdf')).rejects.toBeInstanceOf(
      KnowledgeExtractError,
    )
  })
})

describe('document dates', () => {
  it('parses PDF and ISO dates and drops unusable ones', () => {
    expect(parseDocumentDate("D:20240131120000+01'00'")?.toISOString().slice(0, 10)).toBe('2024-01-31')
    expect(parseDocumentDate('D:2023')?.toISOString().slice(0, 10)).toBe('2023-01-01')
    expect(parseDocumentDate('2025-06-01T08:00:00Z')?.toISOString().slice(0, 10)).toBe('2025-06-01')
    expect(parseDocumentDate('not a date')).toBeNull()
    expect(parseDocumentDate('2999-01-01')).toBeNull()
    expect(parseDocumentDate(undefined)).toBeNull()
  })

  it('takes the validity date from PDF metadata', async () => {
    const result = await extractKnowledgeFile(await pdf('Pricing valid for the current quarter only, per our policy.'), 's.pdf')
    expect(result.validAsOf).toBeInstanceOf(Date)
  })
})
