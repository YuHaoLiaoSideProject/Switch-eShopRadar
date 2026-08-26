<script setup lang="ts">
interface Props {
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 24,
});
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 2C10.97 6.15 7 8 7 12.5C7 15.54 9.24 18 12 18C14.76 18 17 15.54 17 12.5C17 8 13.03 6.15 12 2ZM12 16C10.34 16 9 14.43 9 12.5C9 10.84 10.8 9.72 12 8.88C13.2 9.72 15 10.84 15 12.5C15 14.43 13.66 16 12 16Z" />
  </svg>
</template>
