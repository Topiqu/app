const MAX_AVATAR_BYTES = 10 * 1024 * 1024
type Translate = (key: string) => string

interface CropperOptions {
  viewportWidth?: number
  viewportHeight?: number
  outputWidth?: number
  outputHeight?: number
  fit?: 'cover' | 'contain'
}

export function useAvatarCropper(t: Translate, onPreview: (url: string | null) => void, options: CropperOptions = {}) {
  const viewportWidth = options.viewportWidth ?? 288
  const viewportHeight = options.viewportHeight ?? 288
  const outputWidth = options.outputWidth ?? 1024
  const outputHeight = options.outputHeight ?? 1024
  const fit = options.fit ?? 'cover'
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
    const scale = baseScale(width, height, viewportWidth, viewportHeight) * zoom.value
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

  function baseScale(width: number, height: number, frameWidth: number, frameHeight: number) {
    const scales = [frameWidth / width, frameHeight / height]
    return fit === 'contain' ? Math.min(...scales) : Math.max(...scales)
  }

  function clampOffset() {
    const image = sourceImage.value
    if (!image) return
    const { width, height } = rotatedDimensions(image)
    const scale = baseScale(width, height, viewportWidth, viewportHeight) * zoom.value
    const maxX = Math.abs(width * scale - viewportWidth) / 2
    const maxY = Math.abs(height * scale - viewportHeight) / 2
    offset.x = Math.max(-maxX, Math.min(maxX, offset.x))
    offset.y = Math.max(-maxY, Math.min(maxY, offset.y))
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
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('common.avatar.processingError'))

    const { width, height } = rotatedDimensions(image)
    const scale = baseScale(width, height, outputWidth, outputHeight) * zoom.value
    context.translate(
      outputWidth / 2 + offset.x * (outputWidth / viewportWidth),
      outputHeight / 2 + offset.y * (outputHeight / viewportHeight),
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
