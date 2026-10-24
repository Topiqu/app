export default defineAppConfig({
  ui: {
    toast: {
      slots: {
        root: 'rounded-(--topiqu-surface-radius)',
        title: 'break-words',
        description: 'break-words',
        actions: 'flex-wrap',
      },
      defaultVariants: { orientation: 'vertical' },
    },
    colors: {
      primary: 'slate',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },
    icons: {
      arrowDown: 'mdi:arrow-down',
      arrowLeft: 'mdi:arrow-left',
      arrowRight: 'mdi:arrow-right',
      arrowUp: 'mdi:arrow-up',
      caution: 'mdi:alert-circle-outline',
      check: 'mdi:check',
      chevronDoubleLeft: 'mdi:chevron-double-left',
      chevronDoubleRight: 'mdi:chevron-double-right',
      chevronDown: 'mdi:chevron-down',
      chevronLeft: 'mdi:chevron-left',
      chevronRight: 'mdi:chevron-right',
      chevronUp: 'mdi:chevron-up',
      close: 'mdi:close',
      copy: 'mdi:content-copy',
      copyCheck: 'mdi:check-all',
      dark: 'mdi:weather-night',
      drag: 'mdi:drag-vertical',
      ellipsis: 'mdi:dots-horizontal',
      error: 'mdi:close-circle',
      external: 'mdi:open-in-new',
      eye: 'mdi:eye',
      eyeOff: 'mdi:eye-off',
      file: 'mdi:file-outline',
      folder: 'mdi:folder-outline',
      folderOpen: 'mdi:folder-open-outline',
      hash: 'mdi:pound',
      info: 'mdi:information-outline',
      light: 'mdi:weather-sunny',
      loading: 'mdi:loading',
      menu: 'mdi:menu',
      minus: 'mdi:minus',
      panelClose: 'mdi:page-layout-sidebar-left',
      panelOpen: 'mdi:page-layout-sidebar-left',
      plus: 'mdi:plus',
      reload: 'mdi:refresh',
      search: 'mdi:magnify',
      stop: 'mdi:stop',
      star: 'mdi:star',
      success: 'mdi:check-circle',
      system: 'mdi:monitor',
      tip: 'mdi:lightbulb-outline',
      upload: 'mdi:upload',
      warning: 'mdi:alert-outline',
    },
    button: {
      slots: {
        base: 'rounded-[var(--ui-radius)] whitespace-nowrap',
        label: 'whitespace-nowrap',
      },
      variants: {
        variant: {
          overlay: {
            base: 'rounded-full bg-default/95 text-default ring-1 ring-accented backdrop-blur-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          },
        },
        size: {
          xs: { base: 'h-8 px-3 text-xs gap-1' },
          sm: { base: 'h-9 px-3.5 text-xs gap-1.5' },
          md: { base: 'h-10 px-4 text-sm gap-1.5' },
          lg: { base: 'h-11 px-5 text-sm gap-2' },
          metric: { base: 'h-auto min-h-12 px-3 py-2 text-xs gap-1.5' },
          swatch: { base: 'size-8 shrink-0 rounded-full p-0 justify-center' },
          row: { base: 'h-auto px-4 py-3 text-sm gap-3 sm:px-6' },
        },
      },
      compoundVariants: [
        { color: 'error', variant: 'overlay', class: 'text-error' },
        { square: true, size: 'xs', class: 'size-8 shrink-0 p-0 justify-center' },
        { square: true, size: 'sm', class: 'size-9 shrink-0 p-0 justify-center' },
        { square: true, size: 'md', class: 'size-10 shrink-0 p-0 justify-center' },
        { square: true, size: 'lg', class: 'size-11 shrink-0 p-0 justify-center' },
        // Ink in the dashboard; `.publication-surface` points `action` back at the tenant accent.
        {
          color: 'primary',
          variant: 'solid',
          class:
            'bg-action hover:bg-action/85 active:bg-action/85 disabled:bg-action aria-disabled:bg-action outline-action/25',
        },
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
    tabs: {
      variants: {
        variant: {
          pill: {
            list: 'rounded-(--ui-radius) p-1',
            trigger: 'rounded-[calc(var(--ui-radius)-0.25rem)]',
            indicator: 'rounded-[calc(var(--ui-radius)-0.25rem)]',
          },
        },
      },
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
    inputTags: {
      slots: {
        base: 'rounded-(--ui-radius) p-1.5',
        item: 'rounded-[calc(var(--ui-radius)-0.375rem)]',
      },
      variants: {
        size: {
          xs: { base: 'p-1' },
          sm: { base: 'p-1.5' },
          md: { base: 'p-1.5' },
          lg: { base: 'p-2' },
          xl: { base: 'p-2' },
        },
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
      variants: {
        variant: {
          segmented: {
            root: '@container',
            fieldset: 'grid grid-cols-3 gap-1 rounded-(--ui-radius) bg-elevated p-1',
            item: 'group relative min-h-10 min-w-0 cursor-pointer items-center justify-center rounded-[calc(var(--ui-radius)-0.25rem)] px-3 py-2 text-center has-data-[state=checked]:bg-default has-data-[state=checked]:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-primary',
            container: 'sr-only',
            label: 'text-xs leading-5 text-muted group-has-data-[state=checked]:text-highlighted @sm:text-sm',
          },
        },
      },
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'list',
        indicator: 'start',
      },
    },
    fileUpload: {
      slots: { base: 'rounded-(--topiqu-surface-radius)' },
      defaultVariants: {
        color: 'primary',
        size: 'md',
        variant: 'area',
      },
    },
    card: {
      slots: {
        root: 'rounded-(--topiqu-surface-radius) ring-default',
      },
      variants: {
        variant: {
          editorial: { root: 'overflow-visible rounded-none bg-transparent ring-0 shadow-none' },
        },
      },
      defaultVariants: {
        variant: 'outline',
      },
    },
    pageCard: {
      slots: { root: 'rounded-(--topiqu-surface-radius)' },
      defaultVariants: {
        variant: 'outline',
        highlightColor: 'primary',
        spotlightColor: 'primary',
      },
    },
    footer: {
      slots: {
        container: 'flex flex-col gap-5 py-6 sm:py-8 lg:flex-row lg:gap-8',
        left: 'order-1 mt-0 min-w-0 w-full justify-start lg:w-auto',
        center: 'order-2 mt-0 min-w-0 w-full justify-start empty:hidden lg:w-auto',
        right: 'order-3 min-w-0 w-full justify-start empty:hidden lg:w-auto lg:flex-none',
      },
    },
    modal: {
      slots: {
        content: 'flex flex-col',
        header: 'shrink-0',
        body: 'min-h-0 flex-1 overflow-y-auto',
        footer: 'shrink-0',
      },
      // Sizing lives on the non-fullscreen variant: as a slot class it also capped `fullscreen`
      // modals, which only add `inset-0`, into a 2xl panel pinned to the top-left corner.
      variants: {
        fullscreen: {
          false: {
            content:
              'max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl rounded-(--topiqu-surface-radius) max-sm:inset-0 max-sm:size-full max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
          },
        },
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
        content: 'rounded-(--topiqu-surface-radius) bg-default ring ring-default',
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
      base: 'rounded-(--ui-radius) bg-accented',
    },
    empty: {
      slots: { root: 'rounded-(--topiqu-surface-radius)' },
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
      slots: { link: 'rounded-(--ui-radius)' },
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
