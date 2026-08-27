import { computed, onMounted } from 'vue';
import { useGamesStore } from '@/stores/games';
import { usePreferencesStore } from '@/stores/preferences';
import type { Game } from '@/types';

export function useGamePage(
  getGames: (gamesStore: ReturnType<typeof useGamesStore>) => Game[],
) {
  const gamesStore = useGamesStore();
  const prefsStore = usePreferencesStore();

  const games = computed(() => {
  const raw = getGames(gamesStore) as Game[];
  return prefsStore.filterIgnored(raw);
});
  const isEmpty = computed(
    () => !gamesStore.loading && !gamesStore.error && games.value.length === 0,
  );

  onMounted(() => {
    if (!gamesStore.loading && gamesStore.games.length === 0) {
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

  return {
    gamesStore,
    prefsStore,
    games,
    isEmpty,
    handleRetry,
    handleToggleIgnore,
    handleToggleWishlist,
  };
}
