import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('emoji comment preview', () => {
  it('shares the production reaction chip with real comments', () => {
    const comment = source('app/components/Comment/index.vue')
    const preview = source('app/components/Emoji/CommentPreview.vue')

    expect(comment).toContain('<EmojiReactionChip')
    expect(preview).toContain('<EmojiReactionChip')
  })

  it('renders the selected queued emoji in a comment mockup', () => {
    const create = source('app/components/Emoji/Create.vue')

    expect(create).toContain('<EmojiCommentPreview')
    expect(create).toContain(':imageUrl="selectedPreview.previewUrl"')
    expect(create).toContain(':shortcode="selectedPreview.shortcode')
  })
})
