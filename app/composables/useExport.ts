import type { ArticleWithDetails } from '~~/types/article'

import { jsPDF } from 'jspdf'

export function useExport() {
  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getFilename = (data: ArticleWithDetails[], ext: string) => {
    if (data.length === 1 && data[0]) {
      return `article-${data[0].slug}.${ext}`
    }
    return `articles-export-${new Date().toISOString().slice(0, 10)}.${ext}`
  }

  const normalizeInput = (data: ArticleWithDetails | ArticleWithDetails[]): ArticleWithDetails[] => {
    const arr = Array.isArray(data) ? data : [data]
    return arr.filter(Boolean)
  }

  const stripHtml = (html: string | null | undefined): string => {
    if (!html) return ''
    const parser = new DOMParser()
    const processed = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')

    const doc = parser.parseFromString(processed, 'text/html')
    return doc.body.textContent || ''
  }

  const loadImageToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (!response.ok) throw new Error()

      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const exportJson = (data: ArticleWithDetails | ArticleWithDetails[]) => {
    const arr = normalizeInput(data)
    if (!arr.length) return

    const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' })
    downloadFile(blob, getFilename(arr, 'json'))
  }

  const exportCsv = (data: ArticleWithDetails | ArticleWithDetails[]) => {
    const arr = normalizeInput(data)
    if (!arr.length) return

    const headers = ['Title', 'Slug', 'Status', 'Date', 'ImageUrl', 'Content Preview']

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = arr.map((a) => [
      a.title,
      a.slug,
      a.status,
      new Date(a.createdAt).toLocaleString('cs-CZ'),
      a.imageUrl || '',
      stripHtml(a.content).slice(0, 150),
    ])

    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadFile(blob, getFilename(arr, 'csv'))
  }

  const exportPdf = async (data: ArticleWithDetails | ArticleWithDetails[]) => {
    if (import.meta.server) return

    const arr = normalizeInput(data)
    if (!arr.length) return

    let autoTable: any
    try {
      const mod = await import('jspdf-autotable')
      autoTable = mod.default || mod
    } catch {
      return
    }

    const doc = new jsPDF()
    const fontModule = await import('~~/server/utils/pdfFont')
    const fontBase64 = fontModule.customFontBase64
    if (fontBase64) {
      doc.addFileToVFS('CustomFont.ttf', fontBase64)
      doc.addFont('CustomFont.ttf', 'CustomFont', 'normal')
      doc.setFont('CustomFont')
    }

    if (arr.length === 1) {
      const article = arr[0]!
      const margin = 14
      let cursorY = 20

      doc.setFontSize(18)
      const titleLines = doc.splitTextToSize(article.title, 180)
      doc.text(titleLines, margin, cursorY)
      cursorY += titleLines.length * 10

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(
        `Status: ${article.status} | Date: ${new Date(article.createdAt).toLocaleDateString('cs-CZ')}`,
        margin,
        cursorY,
      )
      cursorY += 10
      doc.setTextColor(0)

      if (article.imageUrl) {
        const imgData = await loadImageToBase64(article.imageUrl)
        if (imgData) {
          const props = doc.getImageProperties(imgData)
          const width = 100
          const height = (props.height * width) / props.width
          doc.addImage(imgData, 'JPEG', margin, cursorY, width, height)
          cursorY += height + 10
        }
      }

      doc.setFontSize(11)
      const cleanContent = stripHtml(article.content)
      const contentLines = doc.splitTextToSize(cleanContent, 180)

      const pageHeight = doc.internal.pageSize.height
      contentLines.forEach((line: string) => {
        if (cursorY > pageHeight - 20) {
          doc.addPage()
          cursorY = 20
        }
        doc.text(line, margin, cursorY)
        cursorY += 6
      })
    } else {
      const imagePromises = arr.map((a) => (a.imageUrl ? loadImageToBase64(a.imageUrl) : Promise.resolve(null)))
      const imagesResults = await Promise.allSettled(imagePromises)
      const images = imagesResults.map((r) => (r.status === 'fulfilled' ? r.value : null))

      doc.setFontSize(16)
      doc.text('Articles List', 14, 15)

      autoTable(doc, {
        startY: 25,
        head: [['', 'Title', 'Status', 'Date']],
        body: arr.map((a) => ['', a.title, a.status, new Date(a.createdAt).toLocaleDateString('cs-CZ')]),
        theme: 'striped',
        styles: {
          fontSize: 10,
          cellPadding: 3,
          valign: 'middle',
          font: fontBase64 ? 'CustomFont' : 'helvetica',
        },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
          0: { cellWidth: 15, minCellHeight: 15 },
          1: { cellWidth: 'auto' },
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 0) {
            const imgData = images[data.row.index]
            if (imgData) {
              doc.addImage(imgData, 'JPEG', data.cell.x + 2, data.cell.y + 2, 11, 11)
            }
          }
        },
      })
    }

    downloadFile(doc.output('blob'), getFilename(arr, 'pdf'))
  }

  return { exportJson, exportCsv, exportPdf }
}
