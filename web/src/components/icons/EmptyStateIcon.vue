<script setup lang="ts">
interface Props {
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 120,
});
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 120 120" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="empty-state-icon">
    <!-- Gamepad body -->
    <path d="M35 55H85C88.31 55 91 57.69 91 61V69C91 72.31 88.31 75 85 75H75C73.9 75 72.81 74.55 72.04 73.78L66 67.73L60 73.73V73.78C59.19 74.55 58.1 75 57 75H45C41.69 75 39 72.31 39 69V61C39 57.69 41.69 55 45 55ZM45 58V64H42V60C42 59.45 42.45 59 43 59H45V58ZM66 58L72 64H69C68.45 64 68 63.55 68 63V58H66ZM75 58H77C77.55 58 78 58.45 78 59V64H75V58ZM54 60V63C54 63.55 53.55 64 53 64H50V59H53C53.55 59 54 59.45 54 60Z" />
    <!-- D-pad left -->
    <path d="M44 62H48V60H50V64H48V62H44Z" opacity="0.5" />
    <!-- Exclamation mark -->
    <rect x="82" y="32" width="8" height="16" rx="4" />
    <rect x="82" y="54" width="8" height="8" rx="4" opacity="0.5" />
  </svg>
</template>
