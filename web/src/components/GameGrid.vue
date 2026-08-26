<script setup lang="ts">
import GameSkeleton from './GameSkeleton.vue';
import RetryButton from './RetryButton.vue';

interface Props {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
}
defineProps<Props>();
defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <div class="game-grid-wrapper">
    <!-- Loading skeleton -->
    <div v-if="loading" class="game-grid" role="status" aria-live="polite">
      <GameSkeleton v-for="n in 8" :key="n" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="game-grid-error" role="alert">
      <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <p class="error-message">載入失敗：{{ error }}</p>
      <RetryButton @retry="$emit('retry')" />
    </div>

    <!-- Empty state -->
    <div v-else-if="empty" class="game-grid-empty">
      <svg class="empty-icon" width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="15" y="20" width="50" height="35" rx="6" stroke="currentColor" stroke-width="2" />
        <circle cx="30" cy="37" r="3" fill="currentColor" opacity="0.4" />
        <circle cx="50" cy="37" r="3" fill="currentColor" opacity="0.4" />
        <rect x="35" y="44" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
        <text x="40" y="70" text-anchor="middle" fill="currentColor" font-size="10" opacity="0.5">No Data</text>
      </svg>
      <p class="empty-message">{{ emptyMessage ?? '暫無資料' }}</p>
    </div>

    <!-- Content -->
    <div v-else class="game-grid">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.game-grid-wrapper {
  width: 100%;
}

.game-grid {
  display: grid;
  gap: var(--gap-md);
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

@media (max-width: 1023px) {
  .game-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (max-width: 767px) {
  .game-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-sm);
  }
}

.game-grid-error,
.game-grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-md);
  padding: var(--gap-xl) var(--gap-md);
  color: var(--muted);
}

.game-grid-error {
  color: var(--danger);
}

.error-message,
.empty-message {
  font-size: var(--fs-lg);
  text-align: center;
  margin: 0;
}
</style>
