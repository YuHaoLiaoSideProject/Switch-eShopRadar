<script setup lang="ts">
import GameCard from '@/components/GameCard.vue';
import GameGrid from '@/components/GameGrid.vue';
import FilterBar from '@/components/FilterBar.vue';
import { useGamePage } from '@/composables/useGamePage';
import { ref, computed } from 'vue';
import type { Platform } from '@/types';

const {
  gamesStore, prefsStore, games, isEmpty,
  showIgnored, toggleShowIgnored,
  handleRetry, handleToggleIgnore, handleToggleWishlist,
} = useGamePage((s) => s.hotGames);

const platformFilter = ref<Platform | 'all'>('all');
const searchQuery = ref('');
const sortBy = ref<'title' | 'price' | 'discount'>('title');

const filteredGames = computed(() => {
  let result = games.value;
  if (platformFilter.value !== 'all') {
    result = result.filter((g) => g.platform === platformFilter.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((g) => g.title.toLowerCase().includes(q));
  }
  if (sortBy.value === 'price') {
    result = [...result].sort((a, b) => {
      const pa = gamesStore.getPrice(a.id)?.discountPrice ?? gamesStore.getPrice(a.id)?.amount ?? 0;
      const pb = gamesStore.getPrice(b.id)?.discountPrice ?? gamesStore.getPrice(b.id)?.amount ?? 0;
      return pa - pb;
    });
  } else if (sortBy.value === 'discount') {
    result = [...result].sort((a, b) => {
      const pa = gamesStore.getPrice(a.id);
      const pb = gamesStore.getPrice(b.id);
      const da = pa?.discountPrice && pa?.regularPrice ? (pa.regularPrice - pa.discountPrice) / pa.regularPrice : 0;
      const db = pb?.discountPrice && pb?.regularPrice ? (pb.regularPrice - pb.discountPrice) / pb.regularPrice : 0;
      return db - da;
    });
  } else {
    result = [...result].sort((a, b) => a.title.localeCompare(b.title));
  }
  return result;
});
</script>

<template>
  <div class="hot-page">
    <h2>🔥 熱門遊戲</h2>
    <p class="subtitle">根據折扣活動與評分指標綜合排序</p>

    <FilterBar
      v-model:platform-filter="platformFilter"
      v-model:search-query="searchQuery"
      v-model:sort-by="sortBy"
      :show-ignored="showIgnored"
      :ignored-count="prefsStore.ignoredCount"
      @update:show-ignored="toggleShowIgnored"
    />

    <GameGrid
      :loading="gamesStore.loading"
      :error="gamesStore.error"
      :empty="filteredGames.length === 0"
      empty-message="暫無熱門遊戲資料"
      @retry="handleRetry"
    >
      <GameCard
        v-for="game in filteredGames"
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
