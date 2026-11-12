<template>
  <svg
    class="wb-chrome-toggle-icon"
    :class="{ 'is-mirrored': mirrored }"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
    <path d="M9 3.5v17" />
    <path d="M12.2 8h5.6M12.2 12h5.6M12.2 16h3.8" />
    <path d="m6.8 9-2.6 3 2.6 3" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    mirrored?: boolean;
  }>(),
  {
    mirrored: false,
  },
);
</script>

<style scoped>
.wb-chrome-toggle-icon {
  display: block;
  flex-shrink: 0;
  transition: transform 180ms ease;
}
.wb-chrome-toggle-icon.is-mirrored {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .wb-chrome-toggle-icon {
    transition: none;
  }
}
</style>
