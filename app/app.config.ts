export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },
    icons: {
      arrowDown: 'i-mdi-arrow-down',
      arrowLeft: 'i-mdi-arrow-left',
      arrowRight: 'i-mdi-arrow-right',
      arrowUp: 'i-mdi-arrow-up',
      caution: 'i-mdi-alert-circle-outline',
      check: 'i-mdi-check',
      chevronDoubleLeft: 'i-mdi-chevron-double-left',
      chevronDoubleRight: 'i-mdi-chevron-double-right',
      chevronDown: 'i-mdi-chevron-down',
      chevronLeft: 'i-mdi-chevron-left',
      chevronRight: 'i-mdi-chevron-right',
      chevronUp: 'i-mdi-chevron-up',
      close: 'i-mdi-close',
      copy: 'i-mdi-content-copy',
      copyCheck: 'i-mdi-check-all',
      dark: 'i-mdi-weather-night',
      drag: 'i-mdi-drag-vertical',
      ellipsis: 'i-mdi-dots-horizontal',
      error: 'i-mdi-close-circle',
      external: 'i-mdi-open-in-new',
      eye: 'i-mdi-eye',
      eyeOff: 'i-mdi-eye-off',
      file: 'i-mdi-file-outline',
      folder: 'i-mdi-folder-outline',
      folderOpen: 'i-mdi-folder-open-outline',
      hash: 'i-mdi-pound',
      info: 'i-mdi-information-outline',
      light: 'i-mdi-weather-sunny',
      loading: 'i-mdi-loading',
      menu: 'i-mdi-menu',
      minus: 'i-mdi-minus',
      panelClose: 'i-mdi-page-layout-sidebar-left',
      panelOpen: 'i-mdi-page-layout-sidebar-left',
      plus: 'i-mdi-plus',
      reload: 'i-mdi-refresh',
      search: 'i-mdi-magnify',
      stop: 'i-mdi-stop',
      star: 'i-mdi-star',
      success: 'i-mdi-check-circle',
      system: 'i-mdi-monitor',
      tip: 'i-mdi-lightbulb-outline',
      upload: 'i-mdi-upload',
      warning: 'i-mdi-alert-outline',
    },
    button: {
      slots: {
        base: 'rounded-[var(--ui-radius)] whitespace-nowrap',
        label: 'whitespace-nowrap',
      },
      variants: {
        size: {
          xs: { base: 'h-8 px-2 text-xs gap-1' },
          sm: { base: 'h-9 px-2.5 text-xs gap-1.5' },
          md: { base: 'h-10 px-3 text-sm gap-1.5' },
          lg: { base: 'h-11 px-3.5 text-sm gap-2' },
        },
      },
      compoundVariants: [
        { square: true, size: 'xs', class: 'size-8 shrink-0 p-0 justify-center' },
        { square: true, size: 'sm', class: 'size-9 shrink-0 p-0 justify-center' },
        { square: true, size: 'md', class: 'size-10 shrink-0 p-0 justify-center' },
        { square: true, size: 'lg', class: 'size-11 shrink-0 p-0 justify-center' },
      ],
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },
    fieldGroup: {
      base: 'isolate',
    },
    input: {
      slots: { root: 'w-full', base: 'rounded-[var(--ui-radius)]' },
      variants: {
        size: {
          xs: { base: 'h-8' },
          sm: { base: 'h-9' },
          md: { base: 'h-10' },
          lg: { base: 'h-11' },
        },
      },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    textarea: {
      slots: { root: 'w-full', base: 'rounded-[var(--ui-radius)]' },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    inputNumber: {
      slots: { root: 'w-full', base: 'rounded-[var(--ui-radius)]' },
      variants: {
        size: {
          xs: { base: 'h-8' },
          sm: { base: 'h-9' },
          md: { base: 'h-10' },
          lg: { base: 'h-11' },
        },
      },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    pinInput: {
      slots: { root: 'w-full', base: 'rounded-[var(--ui-radius)]' },
      variants: {
        size: {
          xs: { base: 'size-8' },
          sm: { base: 'size-9' },
          md: { base: 'size-10' },
          lg: { base: 'size-11' },
        },
      },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    select: {
      slots: {
        base: 'w-full rounded-[var(--ui-radius)]',
        content: 'min-w-[max(12rem,var(--reka-select-trigger-width))] max-w-[calc(100vw-1rem)]',
        itemLabel: 'whitespace-normal break-words',
      },
      variants: {
        size: {
          xs: { base: 'h-8' },
          sm: { base: 'h-9' },
          md: { base: 'h-10' },
          lg: { base: 'h-11' },
        },
      },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    selectMenu: {
      slots: {
        base: 'w-full rounded-[var(--ui-radius)]',
        content: 'min-w-[max(12rem,var(--reka-combobox-trigger-width))] max-w-[calc(100vw-1rem)]',
        itemLabel: 'whitespace-normal break-words',
      },
      variants: {
        size: {
          xs: { base: 'h-8' },
          sm: { base: 'h-9' },
          md: { base: 'h-10' },
          lg: { base: 'h-11' },
        },
      },
      defaultVariants: {
        color: 'primary',
        variant: 'outline',
        size: 'md',
      },
    },
    formField: {
      defaultVariants: {
        size: 'md',
      },
    },
    checkbox: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'list',
        indicator: 'start',
      },
    },
    checkboxGroup: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'list',
      },
    },
    switch: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
      },
    },
    radioGroup: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'list',
        indicator: 'start',
      },
    },
    fileUpload: {
      slots: { base: 'rounded-[var(--topiqu-surface-radius)]' },
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'area',
      },
    },
    card: {
      slots: {
        root: 'rounded-[var(--topiqu-surface-radius)] ring-default',
      },
      defaultVariants: {
        variant: 'outline',
      },
    },
    pageCard: {
      slots: { root: 'rounded-[var(--topiqu-surface-radius)]' },
      defaultVariants: {
        variant: 'outline',
        highlightColor: 'primary',
        spotlightColor: 'primary',
      },
    },
    modal: {
      slots: {
        content:
          'flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col rounded-[var(--topiqu-surface-radius)] max-sm:inset-0 max-sm:size-full max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
        header: 'shrink-0',
        body: 'min-h-0 flex-1 overflow-y-auto',
        footer: 'shrink-0',
      },
    },
    slideover: {
      slots: {
        content: 'flex w-full max-w-xl flex-col bg-default max-sm:max-w-none',
        header: 'shrink-0',
        body: 'min-h-0 flex-1 overflow-y-auto',
        footer: 'shrink-0',
      },
    },
    drawer: {
      slots: {
        content: 'max-h-[calc(100dvh-4.125rem)] bg-default',
      },
    },
    popover: {
      slots: {
        content: 'bg-default ring ring-default',
      },
    },
    dropdownMenu: {
      slots: {
        content: 'min-w-[max(12rem,var(--reka-dropdown-menu-trigger-width))] max-w-[calc(100vw-1rem)]',
        itemLabel: 'whitespace-normal break-words',
      },
      defaultVariants: {
        size: 'md',
      },
    },
    tooltip: {
      slots: {
        content: 'bg-elevated text-highlighted ring ring-default',
      },
    },
    alert: {
      defaultVariants: {
        color: 'primary',
        variant: 'soft',
      },
    },
    badge: {
      slots: { base: 'rounded-full', label: 'whitespace-nowrap' },
      defaultVariants: {
        color: 'neutral',
        variant: 'soft',
        size: 'md',
      },
    },
    chip: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
        position: 'top-right',
      },
    },
    progress: {
      defaultVariants: {
        animation: 'carousel',
        color: 'primary',
        size: 'md',
      },
    },
    skeleton: {
      base: 'bg-accented',
    },
    empty: {
      defaultVariants: {
        variant: 'outline',
        size: 'md',
      },
    },
    table: {
      slots: {
        th: 'text-muted font-semibold',
      },
      defaultVariants: {
        loadingColor: 'primary',
        loadingAnimation: 'carousel',
      },
    },
    pagination: {
      slots: {
        root: 'isolate',
      },
    },
    navigationMenu: {
      defaultVariants: {
        color: 'primary',
        highlightColor: 'primary',
        variant: 'pill',
      },
    },
    dashboardSidebar: {
      slots: {
        root: 'h-full min-h-0 bg-default border-default',
        body: 'min-h-0',
      },
    },
    dashboardPanel: {
      slots: {
        root: 'h-full min-h-0 bg-default',
      },
    },
    dashboardNavbar: {
      slots: {
        root: 'border-default bg-default',
      },
    },
    page: {
      slots: {
        root: 'min-w-0',
      },
    },
    pageAside: {
      slots: {
        root: 'border-default',
      },
    },
    pageHeader: {
      slots: {
        root: 'border-default',
      },
    },
    pageSection: {
      slots: {
        root: 'min-w-0',
      },
    },
  },
})
