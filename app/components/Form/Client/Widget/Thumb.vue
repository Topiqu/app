<template>
  <div class="relative h-32 overflow-hidden bg-elevated" aria-hidden="true">
    <!-- Rendered at twice the width and scaled down, so container queries lay it out like a real slot. -->
    <div
      inert
      class="pointer-events-none absolute top-1/2 left-0 w-[200%] origin-top-left px-10 select-none [transform:scale(0.5)_translateY(-50%)]"
    >
      <slot />
    </div>
  </div>
</template>
