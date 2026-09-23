// @vitest-environment jsdom

import { resolve } from 'node:path'
import { Editor } from '@tiptap/core'
import { readFileSync } from 'node:fs'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { Table, TableRow } from '@tiptap/extension-table'

import { Indent } from '../../extensions/indent'
import { sanitizeHtml } from '../../server/utils/sanitize'
import { ColoredTableCell, ColoredTableHeader } from '../../extensions/tableCellColor'

const toolbar = readFileSync(resolve(process.cwd(), 'app/components/Tiptap/Toolbar.vue'), 'utf8')
const tableBubble = readFileSync(resolve(process.cwd(), 'app/components/Tiptap/ToolbarTableBubble.vue'), 'utf8')
const editor = readFileSync(resolve(process.cwd(), 'app/components/Tiptap/Editor.vue'), 'utf8')
const editors: Editor[] = []

function createEditor(content: string) {
  const element = document.createElement('div')
  document.body.append(element)
  const instance = new Editor({
    element,
    content,
    extensions: [StarterKit, Table, TableRow, ColoredTableHeader, ColoredTableCell, Indent],
  })
  editors.push(instance)
  return instance
}

function pressTab(instance: Editor, shiftKey = false) {
  instance.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  )
}

function selectedCellText(instance: Editor) {
  const { $from } = instance.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if (['tableCell', 'tableHeader'].includes($from.node(depth).type.name)) return $from.node(depth).textContent
  }
  return null
}

afterEach(() => {
  editors.splice(0).forEach((instance) => instance.destroy())
  document.body.replaceChildren()
})

describe('TipTap table controls', () => {
  it('keeps insertion in the main toolbar and shows cell actions in the table bubble', () => {
    expect(toolbar).toContain('c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })')
    expect(toolbar).not.toContain('c.addColumnAfter()')
    expect(editor).toContain('<TiptapToolbarTableBubble v-if="edit" :editor />')
    expect(tableBubble).toContain('pluginKey="tableBubbleMenu"')
    expect(tableBubble).toContain("editor.isActive('table')")
    expect(tableBubble).toContain(':getReferencedVirtualElement="getReferencedElement"')
    expect(tableBubble).toContain(':appendTo="getBubbleContainer"')
    expect(tableBubble).toContain("key: 'addColumnAfter'")
    expect(tableBubble).toContain("key: 'addRowAfter'")
    expect(tableBubble).toContain("key: 'deleteTable'")
    expect(tableBubble).toContain('labelKey="cellColor"')
  })

  it('allows ProseMirror to place the selection in a clicked table cell', () => {
    expect(editor).toContain('@click.stop="handleEditorClick"')
    expect(editor).not.toContain('@click.stop.prevent="handleEditorClick"')
  })

  it('moves between cells with Tab and Shift+Tab without indenting their paragraphs', () => {
    const instance = createEditor('<table><tbody><tr><td><p>First</p></td><td><p>Second</p></td></tr></tbody></table>')
    instance.commands.setTextSelection(3)

    pressTab(instance)
    expect(selectedCellText(instance)).toBe('Second')
    expect(instance.getHTML()).not.toContain('data-indent')

    pressTab(instance, true)
    expect(selectedCellText(instance)).toBe('First')
    expect(instance.getHTML()).not.toContain('data-indent')
  })

  it('adds a row when Tab is pressed in the last cell', () => {
    const instance = createEditor('<table><tbody><tr><td><p>First</p></td></tr></tbody></table>')
    instance.commands.setTextSelection(3)

    pressTab(instance)
    expect(instance.getHTML().match(/<tr>/g)).toHaveLength(2)
    expect(instance.getHTML()).not.toContain('data-indent')
  })

  it('saves and restores a manually chosen cell color', () => {
    const instance = createEditor('<table><tbody><tr><th><p>Header</p></th><td><p>Cell</p></td></tr></tbody></table>')
    instance.commands.setTextSelection(3)
    expect(instance.commands.setCellAttribute('backgroundColor', '#ffd966')).toBe(true)
    let cellPosition = -1
    instance.state.doc.descendants((node, position) => {
      if (node.type.name === 'text' && node.text === 'Cell') cellPosition = position
    })
    expect(cellPosition).toBeGreaterThan(0)
    instance.commands.setTextSelection(cellPosition)
    expect(instance.commands.setCellAttribute('backgroundColor', '#112233')).toBe(true)

    const html = sanitizeHtml(instance.getHTML())
    expect(html).toContain('background-color: rgb(255, 217, 102)')
    expect(html).toContain('background-color: rgb(17, 34, 51)')

    const restored = createEditor(html)
    expect(restored.getHTML()).toContain('background-color: rgb(255, 217, 102)')
    expect(restored.getHTML()).toContain('background-color: rgb(17, 34, 51)')
    restored.commands.setTextSelection(cellPosition)
    expect(restored.commands.setCellAttribute('backgroundColor', null)).toBe(true)
    expect(restored.getHTML()).not.toContain('background-color: rgb(17, 34, 51)')
    expect(restored.getHTML()).toContain('background-color: rgb(255, 217, 102)')
  })
})
