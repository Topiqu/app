import { Table } from '@tiptap/extension-table'

import { isChartKind } from '../shared/utils/articleChart'

/** `<table data-chart="bar|line">`: the page draws it as a chart; everywhere else it stays a table. */
export const ChartTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      chart: {
        default: null,
        parseHTML: (element) => {
          const kind = element.getAttribute('data-chart')
          return isChartKind(kind) ? kind : null
        },
        renderHTML: (attrs) => (attrs.chart ? { 'data-chart': attrs.chart } : {}),
      },
    }
  },
})
