import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const toolbar = readFileSync(resolve(process.cwd(), 'app/components/Tiptap/Toolbar.vue'), 'utf8')
const editor = readFileSync(resolve(process.cwd(), 'app/components/Tiptap/Editor.vue'), 'utf8')

describe('TipTap table controls', () => {
  it('offers table insertion before cell-level commands', () => {
    const insert = toolbar.indexOf("key: 'insertTable'")
    const addColumn = toolbar.indexOf("key: 'addColumnAfter'")

    expect(insert).toBeGreaterThan(-1)
    expect(toolbar).toContain('c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })')
    expect(addColumn).toBeGreaterThan(insert)
  })

  it('allows ProseMirror to place the selection in a clicked table cell', () => {
    expect(editor).toContain('@click.stop="handleEditorClick"')
    expect(editor).not.toContain('@click.stop.prevent="handleEditorClick"')
  })
})
