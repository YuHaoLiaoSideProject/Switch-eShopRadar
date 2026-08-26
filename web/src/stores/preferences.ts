import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useLocalStorage } from '@/composables/useLocalStorage';
import type { Game } from '@/types';

const STORAGE_KEY = 'eshop-prefs';

interface PreferencesData {
  ignoreList: string[];
  wishlist: string[];
}

export const usePreferencesStore = defineStore('preferences', () => {
  const { value: stored } = useLocalStorage<PreferencesData>(STORAGE_KEY, {
    ignoreList: [],
    wishlist: [],
  });

  const ignoreList = computed(() => stored.value.ignoreList);
  const wishlist = computed(() => stored.value.wishlist);
  const ignoredCount = computed(() => stored.value.ignoreList.length);
  const wishlistCount = computed(() => stored.value.wishlist.length);

  function addToIgnoreList(gameId: string) {
    if (!stored.value.ignoreList.includes(gameId)) {
      stored.value = {
        ...stored.value,
        ignoreList: [...stored.value.ignoreList, gameId],
      };
    }
  }

  function removeFromIgnoreList(gameId: string) {
    stored.value = {
      ...stored.value,
      ignoreList: stored.value.ignoreList.filter((id) => id !== gameId),
    };
  }

  function isIgnored(gameId: string): boolean {
    return stored.value.ignoreList.includes(gameId);
  }

  function addToWishlist(gameId: string) {
    if (!stored.value.wishlist.includes(gameId)) {
      stored.value = {
        ...stored.value,
        wishlist: [...stored.value.wishlist, gameId],
      };
    }
  }

  function removeFromWishlist(gameId: string) {
    stored.value = {
      ...stored.value,
      wishlist: stored.value.wishlist.filter((id) => id !== gameId),
    };
  }

  function isWishlisted(gameId: string): boolean {
    return stored.value.wishlist.includes(gameId);
  }

  function filterIgnored(games: Game[]): Game[] {
    return games.filter((g) => !stored.value.ignoreList.includes(g.id));
  }

  return {
    ignoreList,
    wishlist,
    ignoredCount,
    wishlistCount,
    addToIgnoreList,
    removeFromIgnoreList,
    isIgnored,
    addToWishlist,
    removeFromWishlist,
    isWishlisted,
    filterIgnored,
  };
});
