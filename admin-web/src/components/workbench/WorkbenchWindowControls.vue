<template>
  <div class="window-controls" role="group" aria-label="窗口控制">
    <button
      type="button"
      class="window-control"
      data-testid="window-minimize"
      aria-label="最小化窗口"
      title="最小化"
      @click="minimize"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
    </button>
    <button
      type="button"
      class="window-control"
      data-testid="window-maximize"
      aria-label="最大化或还原窗口"
      title="最大化 / 还原"
      @click="toggleMaximize"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx=".6" /></svg>
    </button>
    <button
      type="button"
      class="window-control is-close"
      data-testid="window-close"
      aria-label="关闭窗口"
      title="关闭"
      @click="closeWindow"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.4 2.4 7.2 7.2M9.6 2.4 2.4 9.6" /></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
function controls() {
  return typeof window === "undefined" ? undefined : window.electronAPI?.windowControls;
}

function minimize(): void {
  controls()?.minimize();
}

function toggleMaximize(): void {
  controls()?.toggleMaximize();
}

function closeWindow(): void {
  controls()?.close();
}
</script>

<style scoped>
.window-controls {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  align-self: stretch;
}
.window-control {
  width: 34px;
  height: 100%;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--wb-ink2, #626f82);
  cursor: default;
}
.window-control:hover {
  background: var(--wb-hover, #e9edf3);
  color: var(--wb-ink, #16181d);
}
.window-control.is-close:hover {
  background: #d13438;
  color: #fff;
}
.window-control svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
