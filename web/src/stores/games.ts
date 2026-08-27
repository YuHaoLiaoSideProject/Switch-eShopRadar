import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loadGames, loadLatestPrices } from '@/services/data-loader';
import { computeDiscountPercent } from '@eshop/shared';
import type { Game, PriceRecord, Platform } from '@/types';

export const useGamesStore = defineStore('games', () => {
  const games = ref<Game[]>([]);
  const prices = ref<Map<string, PriceRecord>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);

  const platformFilter = ref<Platform | 'all'>('all');
  const searchQuery = ref('');
  const sortBy = ref<'title' | 'price' | 'discount'>('title');

  const filteredGames = computed(() => {
    let result = [...games.value];

    // Platform filter
    if (platformFilter.value !== 'all') {
      result = result.filter((g) => g.platform === platformFilter.value);
    }

    // Search filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy.value) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'price': {
          const priceA = prices.value.get(a.id)?.amount ?? Infinity;
          const priceB = prices.value.get(b.id)?.amount ?? Infinity;
          return priceA - priceB;
        }
        case 'discount': {
          const discA = getDiscountPercent(a.id);
          const discB = getDiscountPercent(b.id);
          return discB - discA; // Higher discount first
        }
        default:
          return 0;
      }
    });

    return result;
  });

  const hotGames = computed(() => {
    // Games with highest discount percentage (placeholder for Metacritic integration)
    return [...games.value]
      .map((g) => ({
        ...g,
        discountPercent: getDiscountPercent(g.id),
      }))
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 20);
  });

  const dealsGames = computed(() => {
    // All discounted games sorted by discount percentage
    return games.value
      .map((g) => ({ ...g, discountPercent: getDiscountPercent(g.id) }))
      .filter((g) => g.discountPercent > 0)
      .sort((a, b) => b.discountPercent - a.discountPercent);
  });

  const newReleases = computed(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return games.value
      .filter((g) => new Date(g.releaseDate) >= threeMonthsAgo)
      .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
  });

  function getDiscountPercent(gameId: string): number {
    const price = prices.value.get(gameId);
    if (!price || !price.discountPrice || price.regularPrice === 0) return 0;
    return computeDiscountPercent(price.regularPrice, price.discountPrice);
  }

  function getPrice(gameId: string): PriceRecord | null {
    return prices.value.get(gameId) ?? null;
  }

  async function fetchGames() {
    loading.value = true;
    error.value = null;
    try {
      const [gamesData, pricesData] = await Promise.all([loadGames(), loadLatestPrices()]);
      games.value = gamesData;
      const priceMap = new Map<string, PriceRecord>();
      for (const p of pricesData) {
        priceMap.set(p.id, p);
      }
      prices.value = priceMap;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  }

  function setPlatformFilter(platform: Platform | 'all') {
    platformFilter.value = platform;
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  function setSortBy(sort: 'title' | 'price' | 'discount') {
    sortBy.value = sort;
  }

  return {
    games,
    prices,
    loading,
    error,
    platformFilter,
    searchQuery,
    sortBy,
    filteredGames,
    hotGames,
    dealsGames,
    newReleases,
    getDiscountPercent,
    getPrice,
    fetchGames,
    setPlatformFilter,
    setSearchQuery,
    setSortBy,
  };
});
