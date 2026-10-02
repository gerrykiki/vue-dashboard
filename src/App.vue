<script setup>
import { RouterView } from 'vue-router';
</script>

<template>
  <main class="app-shell">
    <RouterView />
  </main>
</template>

<style>
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #243447;
  background: #f4f6f9;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  margin: 0;
}

button,
select {
  font: inherit;
}

.app-shell {
  /* min-height: 100vh;  */
  padding: 12px;
}
</style>
