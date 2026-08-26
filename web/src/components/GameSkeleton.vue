<template>
  <div class="game-skeleton" role="status" aria-live="polite" aria-hidden="true">
    <div class="game-skeleton__image skeleton"></div>
    <div class="game-skeleton__content">
      <div class="game-skeleton__title skeleton"></div>
      <div class="game-skeleton__price skeleton"></div>
    </div>
  </div>
</template>

<style scoped>
.game-skeleton {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.game-skeleton__image {
  aspect-ratio: 3 / 4;
  border-radius: 0;
}

.game-skeleton__content {
  padding: var(--gap-sm);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.game-skeleton__title {
  height: 1rem;
  width: 80%;
}

.game-skeleton__price {
  height: 0.85rem;
  width: 50%;
}
</style>
