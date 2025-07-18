import Swal from 'sweetalert2'
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('swal', Swal)
})

declare module '#app' {
  interface NuxtApp {
    $swal: typeof Swal
  }
}
