import type { Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const cleanAltFromFilename = (name: string) =>
  name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()

export function useTiptapImageUpload(editor: Ref<Editor | undefined>, promptAlt: (defaultAlt: string) => Promise<string>) {
  const config = useRuntimeConfig()
  const toast = useToast()

  return async function uploadImage(input: FileList | File[] | null) {
    const file = (input instanceof FileList ? input[0] : input?.[0]) ?? null
    if (!file) return

    const alt = await promptAlt(cleanAltFromFilename(file.name))

    const fileExt = file.name.split('.').pop() || 'jpg'
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    const generatedFilename = `content-${uniqueId}.${fileExt}`
    const optimizedFilename = generatedFilename.replace(/\.[^/.]+$/, '.webp')
    const predictedUrl = `${config.public.cdnUrl}/optimized/${optimizedFilename}`

    editor.value?.commands.setImage({ src: predictedUrl, alt })
    editor.value?.chain().focus().run()

    const form = new FormData()
    form.append('file', file)
    form.append('customFilename', generatedFilename)

    try {
      const { success } = await $fetch('/api/upload', { method: 'POST', body: form })
      if (!success) toast.error({ message: $t('articles.editor.uploadFailed') })
    } catch (e: any) {
      toast.error({ message: e?.data?.message || e?.message || $t('articles.editor.uploadFailed') })
    }
  }
}
