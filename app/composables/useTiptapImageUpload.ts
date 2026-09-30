import type { Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const cleanAltFromFilename = (name: string) =>
  name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()

export function useTiptapImageUpload(
  editor: Ref<Editor | undefined>,
  promptAlt: (defaultAlt: string) => Promise<string>,
) {
  const toast = useToast()

  return async function uploadImage(input: FileList | File[] | null) {
    const file = (input instanceof FileList ? input[0] : input?.[0]) ?? null
    if (!file) return

    const alt = await promptAlt(cleanAltFromFilename(file.name))

    const fileExt = file.name.split('.').pop() || 'jpg'
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    const generatedFilename = `content-${uniqueId}.${fileExt}`

    const form = new FormData()
    form.append('file', file)
    form.append('customFilename', generatedFilename)
    form.append('type', 'article-image')

    try {
      const { success, optimizedUrl, mediaAsset } = await $fetch<{
        success: boolean
        optimizedUrl: string
        mediaAsset: { id: string }
      }>('/api/upload', { method: 'POST', body: form })
      if (success) {
        editor.value?.chain().focus().setFigure({ src: optimizedUrl, alt, mediaId: mediaAsset.id }).run()
      }
      if (!success) toast.add({ color: 'error', title: $t('articles.editor.uploadFailed') })
    } catch (e: any) {
      toast.add({ color: 'error', title: fetchErrorMessage(e, e?.message || $t('articles.editor.uploadFailed')) })
    }
  }
}
