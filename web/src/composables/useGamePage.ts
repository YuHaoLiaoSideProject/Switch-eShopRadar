import { computed, ref, onMounted } from 'vue';
import { useGamesStore } from '@/stores/games';
import { usePreferencesStore } from '@/stores/preferences';
import type { Game } from '@/types';

export function useGamePage(
  getGames: (gamesStore: ReturnType<typeof useGamesStore>) => Game[],
) {
  const gamesStore = useGamesStore();
  const prefsStore = usePreferencesStore();
  const showIgnored = ref(false);

  const games = computed(() => {
    const raw = getGames(gamesStore) as Game[];
    if (showIgnored.value) {
      return raw;
    }
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

  function toggleShowIgnored() {
    showIgnored.value = !showIgnored.value;
  }

  return {
    gamesStore,
    prefsStore,
    games,
    isEmpty,
    showIgnored,
    toggleShowIgnored,
    handleRetry,
    handleToggleIgnore,
    handleToggleWishlist,
  };
}
