import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('media library UI integration', () => {
  it('renders loading, empty, error, selected and paginated states', () => {
    const library = source('app/components/Media/Library.vue')
    expect(library).toContain('<USkeleton')
    expect(library).toContain('<UEmpty')
    expect(library).toContain('<UAlert')
    expect(library).toContain('selectedId === asset.id')
    expect(library).toContain('<UPagination')
    expect(library).toContain('v-model:page="page"')
  })

  it('uses the shared picker for cover and body images', () => {
    const settings = source('app/components/Article/Editor/SettingsPanel.vue')
    const editor = source('app/components/Tiptap/Editor.vue')
    expect(settings).toContain('<MediaPicker')
    expect(settings).toContain('mode="cover"')
    expect(editor).toContain('<MediaPicker')
    expect(editor).toContain('mode="body"')
    expect(editor).toContain('mediaId: asset.id')
  })

  it('makes the complete card interactive and supports modal-wide file drops', () => {
    const library = source('app/components/Media/Library.vue')
    const picker = source('app/components/Media/Picker.vue')
    expect(library).toContain('@click="activate(asset)"')
    expect(library).not.toContain('class="absolute inset-0 size-full"')
    expect(picker).toContain('@drop.prevent="dropFile"')
    expect(picker).toContain('openUploadPicker')
    expect(picker).not.toContain('<UCollapsible')
  })

  it('sizes the drag overlay against the modal body without a second padded body', () => {
    const picker = source('app/components/Media/Picker.vue')
    expect(picker).toContain("body: 'relative h-[min(72dvh,48rem)]")
    expect(picker).toContain('class="h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain"')
    expect(picker).not.toContain('class="relative h-[min(72dvh,48rem)]')
  })

  it('reuses the central detail in the media rights panel', () => {
    const rights = source('app/components/Article/Editor/MediaRights.vue')
    expect(rights).toContain('<MediaDetail')
    expect(rights).not.toContain('$fetch(`/api/media/${id}`')
  })
})
