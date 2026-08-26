<script setup lang="ts">
import { computed } from 'vue';
import GameCard from '@/components/GameCard.vue';
import GameGrid from '@/components/GameGrid.vue';
import { useGamesStore } from '@/stores/games';
import { usePreferencesStore } from '@/stores/preferences';
import { onMounted } from 'vue';

const gamesStore = useGamesStore();
const prefsStore = usePreferencesStore();

const games = computed(() => gamesStore.hotGames);
const isEmpty = computed(() => !gamesStore.loading && !gamesStore.error && games.value.length === 0);

onMounted(() => {
  if (gamesStore.games.length === 0) {
    gamesStore.fetchGames();
  }
});

function handleRetry() {
  gamesStore.fetchGames();
}

function handleToggleIgnore(gameId: string) {
  if (prefsStore.isIgnored(gameId)) {
    prefsStore.removeFromIgnoreList(gameId);
  } else {
    prefsStore.addToIgnoreList(gameId);
  }
}

function handleToggleWishlist(gameId: string) {
  if (prefsStore.isWishlisted(gameId)) {
    prefsStore.removeFromWishlist(gameId);
  } else {
    prefsStore.addToWishlist(gameId);
  }
}
</script>

<template>
  <div class="hot-page">
    <h2>🔥 熱門遊戲</h2>
    <p class="subtitle">根據折扣活動與評分指標綜合排序</p>

    <GameGrid
      :loading="gamesStore.loading"
      :error="gamesStore.error"
      :empty="isEmpty"
      empty-message="暫無熱門遊戲資料"
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
.hot-page h2 {
  margin: 0 0 0.25rem;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 1.5rem;
}
</style>
