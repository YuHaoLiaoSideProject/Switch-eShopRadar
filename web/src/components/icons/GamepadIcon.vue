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
    <path d="M6 9H4V15H6C6 16.66 7.34 18 9 18H10V14H14V18H15C16.66 18 18 16.66 18 15H20V9H18C18 7.34 16.66 6 15 6H14V10H10V6H9C7.34 6 6 7.34 6 9Z" />
  </svg>
</template>
