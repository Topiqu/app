<template>
  <div ref="rootEl" class="relative">
    <Float
      :show="open"
      placement="bottom-end"
      :offset="8"
      portal
      enter="transition duration-200 ease-out"
      enterFrom="opacity-0 translate-y-1 scale-95"
      enterTo="opacity-100 translate-y-0 scale-100"
      leave="transition duration-150 ease-in"
      leaveFrom="opacity-100 translate-y-0 scale-100"
      leaveTo="opacity-0 translate-y-1 scale-95"
    >
      <button
        type="button"
        :aria-expanded="open"
        class="color-swatch w-10 h-10 rounded-full shadow-lg border-2 border-white ring-1 ring-black/10 focus:outline-none transition-transform active:scale-95"
        :style="{ backgroundColor: modelValue || '#000000' }"
        @click="open = !open"
      />

      <div
        ref="panelEl"
        class="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 shadow-2xl rounded-3xl p-6 z-popover w-[300px] flex flex-col gap-6"
      >
        <div
          ref="squareEl"
          class="relative mx-auto rounded-full overflow-hidden cursor-crosshair shadow-inner ring-1 ring-black/5"
          :style="{
            width: `${SIZE}px`,
            height: `${SIZE}px`,
            backgroundColor: hueColor,
          }"
          @pointerdown="startSvDrag"
        >
          <div class="absolute inset-0" :style="{ background: 'linear-gradient(to right, #fff, transparent)' }" />
          <div class="absolute inset-0" :style="{ background: 'linear-gradient(to top, #000, transparent)' }" />

          <div
            class="absolute w-6 h-6 rounded-full border-2 border-white shadow-xl pointer-events-none"
            :style="{
              left: `${saturation * 100}%`,
              top: `${(1 - value) * 100}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: modelValue || '#000000',
            }"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div
            ref="hueSliderEl"
            class="relative h-4 rounded-full cursor-pointer shadow-inner ring-1 ring-black/5"
            :style="{ background: HUE_GRADIENT_LINEAR }"
            @pointerdown="startHueDragLinear"
          >
            <div
              class="absolute w-5 h-5 -top-0.5 rounded-full border-2 border-white shadow-md pointer-events-none"
              :style="{
                left: `${(hue / 360) * 100}%`,
                transform: 'translateX(-50%)',
                backgroundColor: hueColor,
              }"
            />
          </div>
        </div>

        <div class="grid grid-cols-5 gap-2.5">
          <button
            v-for="c in swatches"
            :key="c"
            type="button"
            :class="[
              'w-full aspect-square rounded-lg shadow-sm transition-all hover:scale-110 active:scale-95 focus:outline-none',
              modelValue?.toUpperCase() === c.toUpperCase()
                ? 'ring-2 ring-indigo-500 scale-110 shadow-md'
                : 'ring-1 ring-inset ring-black/10',
            ]"
            :style="{ backgroundColor: c }"
            @click="modelValue = c"
          />
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-neutral-700">
          <div class="flex items-center gap-3 flex-1">
            <div
              class="w-8 h-8 rounded-lg shadow-sm ring-1 ring-black/10"
              :style="{ backgroundColor: modelValue || '#000000' }"
            />
            <span class="text-sm font-bold font-mono text-gray-700 dark:text-gray-200">
              {{ (modelValue || '#000000').toUpperCase() }}
            </span>
          </div>

          <Button
            v-if="modelValue"
            size="sm"
            variant="transparent"
            :title="$t('articles.editor.toolbar.textColor')"
            :aria-label="$t('articles.editor.toolbar.textColor')"
            class="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 px-3 rounded-xl transition-colors"
            @click="modelValue = ''"
          >
            {{ $t('articles.editor.toolbar.removeColor') }}
          </Button>
        </div>
      </div>
    </Float>
  </div>
</template>

<script setup lang="ts">
import { Float } from '@headlessui-float/vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'

const modelValue = defineModel<string>()

const open = shallowRef(false)
const rootEl = useTemplateRef<HTMLElement>('rootEl')
const panelEl = useTemplateRef<HTMLElement>('panelEl')
const squareEl = useTemplateRef<HTMLElement>('squareEl')
const hueSliderEl = useTemplateRef<HTMLElement>('hueSliderEl')

onClickOutside(rootEl, () => (open.value = false), { ignore: [panelEl] })
onKeyStroke('Escape', () => (open.value = false))

const SIZE = 240
const HUE_GRADIENT_LINEAR =
  'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'

const swatches = [
  '#000000',
  '#374151',
  '#6B7280',
  '#9CA3AF',
  '#FFFFFF',
  '#EF4444',
  '#F59E0B',
  '#EAB308',
  '#22C55E',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
]

const hue = shallowRef(0)
const saturation = shallowRef(0)
const value = shallowRef(0)

const hueColor = computed(() => hsvToHex(hue.value, 1, 1))

let internalUpdate = false

watch(
  modelValue,
  (hex) => {
    if (internalUpdate) {
      internalUpdate = false
      return
    }
    const hsv = hexToHsv(hex)
    if (!hsv) return
    hue.value = hsv.h
    saturation.value = hsv.s
    value.value = hsv.v
  },
  { immediate: true },
)

const commit = () => {
  internalUpdate = true
  modelValue.value = hsvToHex(hue.value, saturation.value, value.value)
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

const trackPointer = (elRef: any, onMove: (rect: DOMRect, e: PointerEvent) => void) => (e: PointerEvent) => {
  const el = elRef.value
  if (!el) return
  e.preventDefault()
  const rect = el.getBoundingClientRect()
  const move = (ev: PointerEvent) => onMove(rect, ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  move(e)
}

const startHueDragLinear = trackPointer(hueSliderEl, (rect, e) => {
  const x = clamp((e.clientX - rect.left) / rect.width)
  hue.value = x * 360
  commit()
})

const startSvDrag = trackPointer(squareEl, (rect, e) => {
  saturation.value = clamp((e.clientX - rect.left) / rect.width)
  value.value = clamp(1 - (e.clientY - rect.top) / rect.height)
  commit()
})

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsv(hex?: string) {
  if (!hex) return null
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return null
  const r = parseInt(m[1]!, 16) / 255
  const g = parseInt(m[2]!, 16) / 255
  const b = parseInt(m[3]!, 16) / 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}
</script>

<style scoped>
.color-swatch {
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
}
</style>
