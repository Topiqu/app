import type { ArticleWithDetails } from '~~/types/article'

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

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadFile(blob, getFilename(arr, 'csv'))
  }

  const exportPdf = async (data: ArticleWithDetails | ArticleWithDetails[]) => {
    if (import.meta.server) return

    const arr = normalizeInput(data)
    if (!arr.length) return

    const blob = await $fetch<Blob>('/api/articles/export-pdf', {
      method: 'POST',
      body: { ids: arr.map((a) => a.id) },
      responseType: 'blob',
    })

    downloadFile(blob, getFilename(arr, 'pdf'))
  }

  return { exportJson, exportCsv, exportPdf }
}
