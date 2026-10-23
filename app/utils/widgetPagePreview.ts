import { z } from 'zod'

const slotSchema = z.enum(Object.keys(WIDGET_SLOTS) as [WidgetSlot, ...WidgetSlot[]])

export const widgetPagePreviewStateSchema = z.object({
  slot: slotSchema,
  kind: z.enum(WIDGET_KINDS).nullable(),
  widget: widgetInputSchema.nullable(),
  editingId: z.string().nullable(),
  interactive: z.boolean(),
})
export type WidgetPagePreviewState = z.infer<typeof widgetPagePreviewStateSchema>

export const widgetPagePreviewUpdateSchema = z.object({
  type: z.literal('topiqu:widget-preview:update'),
  state: widgetPagePreviewStateSchema,
  focus: z.boolean().default(false),
})
export const widgetPagePreviewEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('topiqu:widget-preview:ready') }),
  z.object({ type: z.literal('topiqu:widget-preview:select'), slot: slotSchema }),
])

export const canPreviewWidgetSlot = (slot: WidgetSlot, kind: WidgetKind | null | undefined) =>
  !kind || (WIDGET_SLOTS[slot] as readonly WidgetKind[]).includes(kind)

/** Incomplete fields can still show the layout; unsaved HTML stays out of the frame. */
export function widgetPagePreviewDraft(widget: WidgetInput | undefined): WidgetInput | null {
  if (!widget) return null
  let config: unknown = widget.config
  if (widget.kind === 'ANNOUNCEMENT') {
    const link = widget.config.link
    config = {
      ...widget.config,
      text: widget.config.text.trim() || '…',
      richText: widget.config.text.trim() ? widget.config.richText : null,
      link: link?.label.trim() && isSafeWidgetLink(link.url) ? link : null,
      startsAt: null,
      endsAt: null,
    }
  } else if (widget.kind === 'CTA') {
    config = {
      ...widget.config,
      title: widget.config.title.trim() || '…',
      button: {
        url: isSafeWidgetLink(widget.config.button.url) ? widget.config.button.url : '/',
        label: widget.config.button.label.trim() || '…',
      },
    }
  } else if (widget.kind === 'HTML') {
    config = { title: widget.config.title.trim() || '…', height: widget.config.height, html: ' ' }
  }
  const parsed = widgetInputSchema.safeParse({ ...widget, config })
  return parsed.success ? parsed.data : null
}
