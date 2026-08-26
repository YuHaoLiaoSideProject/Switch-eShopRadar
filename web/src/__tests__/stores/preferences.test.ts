import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePreferencesStore } from '@/stores/preferences';

describe('PreferencesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('ignore list', () => {
    it('should start with an empty ignore list', () => {
      const store = usePreferencesStore();
      expect(store.ignoreList).toEqual([]);
    });

    it('should add game to ignore list', () => {
      const store = usePreferencesStore();
      store.addToIgnoreList('70010000000186');
      expect(store.isIgnored('70010000000186')).toBe(true);
    });

    it('should not add duplicate to ignore list', () => {
      const store = usePreferencesStore();
      store.addToIgnoreList('70010000000186');
      store.addToIgnoreList('70010000000186');
      expect(store.ignoreList).toHaveLength(1);
    });

    it('should remove game from ignore list', () => {
      const store = usePreferencesStore();
      store.addToIgnoreList('70010000000186');
      store.addToIgnoreList('70010000000187');
      store.removeFromIgnoreList('70010000000186');
      expect(store.isIgnored('70010000000186')).toBe(false);
      expect(store.isIgnored('70010000000187')).toBe(true);
    });

    it('should return correct ignored count', () => {
      const store = usePreferencesStore();
      expect(store.ignoredCount).toBe(0);
      store.addToIgnoreList('70010000000186');
      expect(store.ignoredCount).toBe(1);
      store.addToIgnoreList('70010000000187');
      expect(store.ignoredCount).toBe(2);
      store.removeFromIgnoreList('70010000000186');
      expect(store.ignoredCount).toBe(1);
    });

    it('should filter games by ignore list', () => {
      const store = usePreferencesStore();
      store.addToIgnoreList('70010000000186');
      const games = [
        { id: '70010000000186', title: 'Zelda', platform: 'switch1' as const, coverUrl: '', releaseDate: '' },
        { id: '70010000000187', title: 'Mario', platform: 'switch1' as const, coverUrl: '', releaseDate: '' },
      ];
      const filtered = store.filterIgnored(games);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('70010000000187');
    });
  });

  describe('wishlist', () => {
    it('should start with an empty wishlist', () => {
      const store = usePreferencesStore();
      expect(store.wishlist).toEqual([]);
    });

    it('should add game to wishlist', () => {
      const store = usePreferencesStore();
      store.addToWishlist('70010000000186');
      expect(store.isWishlisted('70010000000186')).toBe(true);
    });

    it('should not add duplicate to wishlist', () => {
      const store = usePreferencesStore();
      store.addToWishlist('70010000000186');
      store.addToWishlist('70010000000186');
      expect(store.wishlist).toHaveLength(1);
    });

    it('should remove game from wishlist', () => {
      const store = usePreferencesStore();
      store.addToWishlist('70010000000186');
      store.removeFromWishlist('70010000000186');
      expect(store.isWishlisted('70010000000186')).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist ignore list to localStorage', () => {
      const store = usePreferencesStore();
      store.addToIgnoreList('70010000000186');
      const saved = JSON.parse(localStorage.getItem('eshop-prefs') || '{}');
      expect(saved.ignoreList).toContain('70010000000186');
    });

    it('should persist wishlist to localStorage', () => {
      const store = usePreferencesStore();
      store.addToWishlist('70010000000186');
      const saved = JSON.parse(localStorage.getItem('eshop-prefs') || '{}');
      expect(saved.wishlist).toContain('70010000000186');
    });

    it('should load from localStorage on init', () => {
      localStorage.setItem(
        'eshop-prefs',
        JSON.stringify({
          ignoreList: ['70010000000186', '70010000000187'],
          wishlist: ['70010000000188'],
        }),
      );
      const store = usePreferencesStore();
      expect(store.ignoreList).toEqual(['70010000000186', '70010000000187']);
      expect(store.wishlist).toEqual(['70010000000188']);
    });

    it('should use default values when localStorage has invalid data', () => {
      localStorage.setItem('eshop-prefs', 'not-json');
      const store = usePreferencesStore();
      expect(store.ignoreList).toEqual([]);
      expect(store.wishlist).toEqual([]);
    });
  });
});
