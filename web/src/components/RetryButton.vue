<script setup lang="ts">
interface Props {
  loading?: boolean;
}
defineProps<Props>();
defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <button class="retry-btn" :disabled="loading" @click="$emit('retry')">
    <svg
      class="retry-btn__icon"
      :class="{ spinning: loading }"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M17.65 6.35A7.95 7.95 0 0012 4a8 8 0 108 8h-2a6 6 0 11-1.76-4.24L14 10h7V3l-3.35 3.35z"
        fill="currentColor"
      />
    </svg>
    {{ loading ? '重新載入中...' : '重新載入' }}
  </button>
</template>

<style scoped>
.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  height: var(--h);
  padding: 0 var(--gap-md);
  font-size: var(--fs);
  font-weight: 500;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}

.retry-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.retry-btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.retry-btn__icon {
  flex-shrink: 0;
}

.retry-btn__icon.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .retry-btn__icon.spinning {
    animation: none;
  }
}
</style>
