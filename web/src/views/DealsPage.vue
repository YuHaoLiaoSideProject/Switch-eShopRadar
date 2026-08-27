<script setup lang="ts">
import GameCard from '@/components/GameCard.vue';
import GameGrid from '@/components/GameGrid.vue';
import { useGamePage } from '@/composables/useGamePage';

const { gamesStore, prefsStore, games, isEmpty, handleRetry, handleToggleIgnore, handleToggleWishlist } =
  useGamePage((s) => s.dealsGames);
</script>

<template>
  <div class="deals-page">
    <h2>💸 折扣排行</h2>
    <p class="subtitle">依折扣幅度排序，找出最划算的遊戲</p>

    <GameGrid
      :loading="gamesStore.loading"
      :error="gamesStore.error"
      :empty="isEmpty"
      empty-message="暫無折扣遊戲"
      @retry="handleRetry"
    >
      <GameCard
        v-for="game in games"
        :key="game.id"
        :game="game"
        :price="gamesStore.getPrice(game.id)"
        :is-ignored="prefsStore.isIgnored(game.id)"
        :is-wishlisted="prefsStore.isWishlisted(game.id)"
        @toggle-ignore="handleToggleIgnore"
        @toggle-wishlist="handleToggleWishlist"
      />
    </GameGrid>
  </div>
</template>

<style scoped>
.deals-page h2 {
  margin: 0 0 0.25rem;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 1.5rem;
}
</style>
