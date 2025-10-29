import type { ArticleWithDetails } from '~~/types/article'

export function useExport() {
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadImage = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')!.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = url
    })

  const exportJson = (data: ArticleWithDetails | ArticleWithDetails[]) => {
    const arr = Array.isArray(data) ? data : [data]
    if (!arr.length) return
    const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' })
    const name =
      arr.length === 1 ? `article-${arr[0]!.slug}.json` : `articles-${new Date().toISOString().split('T')[0]}.json`
    download(blob, name)
  }

  const exportCsv = (data: ArticleWithDetails | ArticleWithDetails[]) => {
    const arr = Array.isArray(data) ? data : [data]
    if (!arr.length) return
    const headers = ['Title', 'Slug', 'Status', 'Date', 'ImageUrl']
    const rows = arr.map((a) => [
      a.title,
      a.slug,
      a.status,
      new Date(a.createdAt).toLocaleString('cs-CZ'),
      a.imageUrl || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const name =
      arr.length === 1 ? `article-${arr[0]!.slug}.csv` : `articles-${new Date().toISOString().split('T')[0]}.csv`
    download(blob, name)
  }

  const exportPdf = async (data: ArticleWithDetails | ArticleWithDetails[]) => {
    if (import.meta.server) return

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    let autoTable
    try {
      const mod = await import('jspdf-autotable')
      autoTable = (mod as any).default || mod
    } catch {
      return
    }

    if (typeof autoTable !== 'function') return

    const arr = Array.isArray(data) ? data : [data]
    if (!arr.length) return

    if (arr.length === 1) {
      const a = arr[0]!
      doc.setFontSize(18).text(a.title, 14, 20)
      doc.setFontSize(12).text(`Status: ${a.status === 'published' ? 'Published' : 'Draft'}`, 14, 30)
      doc.text(`Date: ${new Date(a.createdAt).toLocaleString('cs-CZ')}`, 14, 38)
      if (a.imageUrl) {
        try {
          const base64 = await loadImage(a.imageUrl)
          doc.addImage(base64, 'JPEG', 14, 46, 50, 50)
        } catch {}
      }
      const content = doc.splitTextToSize(a.content ? a.content.replace(/<[^>]*>/g, '') : '', 180)
      doc.text(content, 14, a.imageUrl ? 110 : 54)
    } else {
      const images = await Promise.all(arr.map((a) => (a.imageUrl ? loadImage(a.imageUrl).catch(() => null) : null)))
      doc.text('Articles List', 14, 15)
      autoTable(doc, {
        head: [['', 'Title', 'Status', 'Date']],
        body: arr.map((a) => [
          '',
          a.title,
          a.status === 'published' ? 'Published' : 'Draft',
          new Date(a.createdAt).toLocaleDateString('cs-CZ'),
        ]),
        startY: 25,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: { 0: { cellWidth: 22 } },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 0 && images[data.row.index]) {
            doc.addImage(images[data.row.index]!, 'JPEG', data.cell.x + 3, data.cell.y + 3, 16, 16)
          }
        },
      })
    }

    const name =
      arr.length === 1 ? `article-${arr[0]!.slug}.pdf` : `articles-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(name)
  }

  return { exportJson, exportCsv, exportPdf }
}
