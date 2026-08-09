const MAX_AVATAR_BYTES = 10 * 1024 * 1024
const CROP_VIEWPORT = 288
const OUTPUT_SIZE = 1024

type Translate = (key: string) => string

export function useAvatarCropper(t: Translate, onPreview: (url: string | null) => void) {
  const selectedFile = shallowRef<File | null>(null)
  const draftUrl = useObjectUrl(selectedFile)
  const sourceImage = shallowRef<HTMLImageElement | null>(null)
  const cropArea = useTemplateRef<HTMLElement>('cropArea')
  const zoom = shallowRef(1)
  const rotation = shallowRef(0)
  const offset = shallowReactive({ x: 0, y: 0 })
  const dragStart = shallowReactive({ pointerX: 0, pointerY: 0, offsetX: 0, offsetY: 0 })
  const errorMessage = shallowRef('')

  const {
    open: chooseFile,
    onChange,
    reset: resetDialog,
  } = useFileDialog({
    accept: 'image/jpeg,image/png,image/webp,image/gif',
    multiple: false,
  })

  const previewStyle = computed(() => {
    const image = sourceImage.value
    if (!image) return {}
    const { width, height } = rotatedDimensions(image)
    const scale = (CROP_VIEWPORT / Math.min(width, height)) * zoom.value
    return {
      left: `calc(50% + ${offset.x}px)`,
      top: `calc(50% + ${offset.y}px)`,
      width: `${image.naturalWidth}px`,
      height: `${image.naturalHeight}px`,
      transform: `translate(-50%, -50%) rotate(${rotation.value}deg) scale(${scale})`,
    }
  })

  const { isSwiping } = usePointerSwipe(cropArea, {
    disableTextSelect: true,
    onSwipeStart(event) {
      dragStart.pointerX = event.clientX
      dragStart.pointerY = event.clientY
      dragStart.offsetX = offset.x
      dragStart.offsetY = offset.y
    },
    onSwipe(event) {
      offset.x = dragStart.offsetX + event.clientX - dragStart.pointerX
      offset.y = dragStart.offsetY + event.clientY - dragStart.pointerY
      clampOffset()
    },
  })

  function rotatedDimensions(image: HTMLImageElement) {
    const swapped = Math.abs(Math.round(rotation.value / 90)) % 2
    return {
      width: swapped ? image.naturalHeight : image.naturalWidth,
      height: swapped ? image.naturalWidth : image.naturalHeight,
    }
  }

  function clampOffset() {
    const image = sourceImage.value
    if (!image) return
    const { width, height } = rotatedDimensions(image)
    const scale = (CROP_VIEWPORT / Math.min(width, height)) * zoom.value
    offset.x = Math.max(-(width * scale - CROP_VIEWPORT) / 2, Math.min((width * scale - CROP_VIEWPORT) / 2, offset.x))
    offset.y = Math.max(-(height * scale - CROP_VIEWPORT) / 2, Math.min((height * scale - CROP_VIEWPORT) / 2, offset.y))
  }

  function resetCrop() {
    zoom.value = 1
    rotation.value = 0
    offset.x = 0
    offset.y = 0
  }

  function reset() {
    selectedFile.value = null
    sourceImage.value = null
    errorMessage.value = ''
    resetCrop()
    resetDialog()
  }

  onChange((files) => {
    const file = files?.[0]
    if (!file) return
    errorMessage.value = ''
    if (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES) {
      errorMessage.value = file.size > MAX_AVATAR_BYTES ? t('common.avatar.tooLarge') : t('common.avatar.invalidFile')
      resetDialog()
      return
    }
    selectedFile.value = file
    resetCrop()
  })

  watch(draftUrl, (url) => {
    if (!url) return onPreview(null)
    const image = new Image()
    image.onload = () => {
      sourceImage.value = image
      onPreview(url)
    }
    image.onerror = () => {
      errorMessage.value = t('common.avatar.invalidFile')
      selectedFile.value = null
    }
    image.src = url
  })

  watch([zoom, rotation], clampOffset)

  async function render() {
    const image = sourceImage.value
    if (!image) throw new Error(t('common.avatar.invalidFile'))
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('common.avatar.processingError'))

    const { width, height } = rotatedDimensions(image)
    const scale = (OUTPUT_SIZE / Math.min(width, height)) * zoom.value
    context.translate(
      OUTPUT_SIZE / 2 + offset.x * (OUTPUT_SIZE / CROP_VIEWPORT),
      OUTPUT_SIZE / 2 + offset.y * (OUTPUT_SIZE / CROP_VIEWPORT),
    )
    context.rotate((rotation.value * Math.PI) / 180)
    context.scale(scale, scale)
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(t('common.avatar.processingError')))),
        'image/webp',
        0.9,
      ),
    )
  }

  return {
    chooseFile,
    cropArea,
    draftUrl,
    errorMessage,
    isSwiping,
    previewStyle,
    render,
    reset,
    rotation,
    zoom,
  }
}
