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
    <path d="M20 6H18.5C19.05 6 19.5 5.55 19.5 5C19.5 3.9 18.6 3 17.5 3C16.8 3 16.19 3.35 15.77 3.89L12 8.67L8.23 3.89C7.81 3.35 7.2 3 6.5 3C5.4 3 4.5 3.9 4.5 5C4.5 5.55 4.95 6 5.5 6H4C2.9 6 2 6.9 2 8V10C2 10.55 2.45 11 3 11H21C21.55 11 22 10.55 22 10V8C22 6.9 21.1 6 20 6ZM6.5 5C7.05 5 7.5 5.45 7.5 6H5.5C5.5 5.45 5.95 5 6.5 5ZM17.5 5C18.05 5 18.5 5.45 18.5 6H16.5C16.5 5.45 16.95 5 17.5 5ZM3 13V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V13H3ZM11 19H5V13H11V19ZM19 19H13V13H19V19Z" />
  </svg>
</template>
