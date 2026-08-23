declare module '#app' {
  interface PageMeta {
    shell?: 'dashboard' | 'product' | 'publication'
    dashboardSidebar?: false
  }
}

export {}
