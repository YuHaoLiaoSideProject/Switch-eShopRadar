<script setup lang="ts">
import GameCard from '@/components/GameCard.vue';
import FilterBar from '@/components/FilterBar.vue';
import { useGamesStore } from '@/stores/games';
import { usePreferencesStore } from '@/stores/preferences';

const gamesStore = useGamesStore();
const prefsStore = usePreferencesStore();

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
  <div class="game-list">
    <FilterBar
      :platform-filter="gamesStore.platformFilter"
      :search-query="gamesStore.searchQuery"
      :sort-by="gamesStore.sortBy"
      @update:platform-filter="gamesStore.setPlatformFilter"
      @update:search-query="gamesStore.setSearchQuery"
      @update:sort-by="gamesStore.setSortBy"
    />

    <div v-if="gamesStore.loading" class="game-list__loading">載入中...</div>
    <div v-else-if="gamesStore.error" class="game-list__error">
      載入失敗：{{ gamesStore.error }}
    </div>
    <div v-else-if="gamesStore.filteredGames.length === 0" class="game-list__empty">
      沒有符合條件的遊戲
    </div>
    <div v-else class="game-list__grid">
      <GameCard
        v-for="game in gamesStore.filteredGames"
        :key="game.id"
        :game="game"
        :price="gamesStore.getPrice(game.id)"
        :is-ignored="prefsStore.isIgnored(game.id)"
        :is-wishlisted="prefsStore.isWishlisted(game.id)"
        @toggle-ignore="handleToggleIgnore"
        @toggle-wishlist="handleToggleWishlist"
      />
    </div>
  </div>
</template>

<style scoped>
.game-list__loading,
.game-list__error,
.game-list__empty {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.game-list__error {
  color: var(--color-error);
}

.game-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}
</style>
