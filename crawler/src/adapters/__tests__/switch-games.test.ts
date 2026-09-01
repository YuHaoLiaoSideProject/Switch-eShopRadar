import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwitchGamesAdapter } from '../switch-games';
import type { SupabaseGame, SupabasePrice } from '../switch-games';

// ─── Mock ofetch ────────────────────────────────────────────

const mockOfetch = vi.fn();
vi.mock('ofetch', () => ({
  ofetch: (...args: unknown[]) => mockOfetch(...args),
}));

// ─── Test Data ──────────────────────────────────────────────

const mockGames: SupabaseGame[] = [
  {
    id: '70010000000186',
    title: 'The Legend of Zelda: Breath of the Wild',
    publisher: 'Nintendo',
    cover_url: 'https://example.com/zelda.jpg',
    release_date: '2017-03-03',
    has_traditional_chinese: true,
    on_sale: false,
  },
  {
    id: '70010000004989',
    title: 'Super Mario Odyssey',
    publisher: 'Nintendo',
    cover_url: 'https://example.com/mario.jpg',
    release_date: '2017-10-27',
    has_traditional_chinese: true,
    on_sale: true,
    discount_rate: 30,
  },
];

const mockPrices: SupabasePrice[] = [
  {
    id: 'price-1',
    game_id: '70010000000186',
    country: 'TW',
    currency: 'TWD',
    regular_price: 1790,
    on_sale: false,
  },
  {
    id: 'price-2',
    game_id: '70010000004989',
    country: 'TW',
    currency: 'TWD',
    regular_price: 1790,
    discount_price: 1253,
    on_sale: true,
    discount_start: '2024-01-01',
    discount_end: '2024-12-31',
  },
];

// ─── Tests ──────────────────────────────────────────────────

describe('SwitchGamesAdapter', () => {
  let adapter: SwitchGamesAdapter;

  beforeEach(() => {
    mockOfetch.mockReset();
    adapter = new SwitchGamesAdapter({
      supabaseUrl: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });
  });

  describe('fetchGames', () => {
    it('should fetch games with default parameters', async () => {
      mockOfetch.mockResolvedValueOnce(mockGames);

      const result = await adapter.fetchGames();

      expect(result).toEqual(mockGames);
      expect(mockOfetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/v1/games?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: 'test-anon-key',
          }),
        }),
      );
    });

    it('should apply title filter', async () => {
      mockOfetch.mockResolvedValueOnce([mockGames[0]]);

      await adapter.fetchGames({ title: 'Zelda' });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('title=ilike.*Zelda*');
    });

    it('should apply Chinese filter', async () => {
      mockOfetch.mockResolvedValueOnce(mockGames);

      await adapter.fetchGames({ hasChinese: true });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('has_traditional_chinese=eq.true');
    });

    it('should apply onSale filter', async () => {
      mockOfetch.mockResolvedValueOnce([mockGames[1]]);

      await adapter.fetchGames({ onSale: true });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('on_sale=eq.true');
    });

    it('should apply limit', async () => {
      mockOfetch.mockResolvedValueOnce(mockGames);

      await adapter.fetchGames({ limit: 10 });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=10');
    });

    it('should return empty array on error', async () => {
      mockOfetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.fetchGames();

      expect(result).toEqual([]);
    });
  });

  describe('searchGames', () => {
    it('should search games by keyword', async () => {
      mockOfetch.mockResolvedValueOnce([mockGames[0]]);

      const result = await adapter.searchGames('Zelda');

      expect(result).toEqual([mockGames[0]]);
      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('title=ilike.*Zelda*');
    });
  });

  describe('getChineseGames', () => {
    it('should fetch games with Chinese support', async () => {
      mockOfetch.mockResolvedValueOnce(mockGames);

      const result = await adapter.getChineseGames();

      expect(result).toEqual(mockGames);
      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('has_traditional_chinese=eq.true');
    });
  });

  describe('getOnSaleGames', () => {
    it('should fetch on-sale games sorted by discount', async () => {
      mockOfetch.mockResolvedValueOnce([mockGames[1]]);

      const result = await adapter.getOnSaleGames();

      expect(result).toEqual([mockGames[1]]);
      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('on_sale=eq.true');
      expect(calledUrl).toContain('order=discount_rate.desc');
    });
  });

  describe('fetchPrices', () => {
    it('should fetch prices with default parameters', async () => {
      mockOfetch.mockResolvedValueOnce(mockPrices);

      const result = await adapter.fetchPrices();

      expect(result).toEqual(mockPrices);
      expect(mockOfetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/v1/prices?'),
        expect.any(Object),
      );
    });

    it('should filter by gameId', async () => {
      mockOfetch.mockResolvedValueOnce([mockPrices[0]]);

      await adapter.fetchPrices({ gameId: '70010000000186' });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('game_id=eq.70010000000186');
    });

    it('should filter by country', async () => {
      mockOfetch.mockResolvedValueOnce(mockPrices);

      await adapter.fetchPrices({ country: 'JP' });

      const calledUrl = mockOfetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('country=eq.JP');
    });

    it('should return empty array on error', async () => {
      mockOfetch.mockRejectedValueOnce(new Error('API error'));

      const result = await adapter.fetchPrices();

      expect(result).toEqual([]);
    });
  });

  describe('toGame', () => {
    it('should convert SupabaseGame to Game type', () => {
      const raw = mockGames[0];
      const result = adapter.toGame(raw);

      expect(result).toEqual({
        id: '70010000000186',
        title: 'The Legend of Zelda: Breath of the Wild',
        platform: 'switch1',
        coverUrl: 'https://example.com/zelda.jpg',
        releaseDate: '2017-03-03',
      });
    });

    it('should handle missing fields with defaults', () => {
      const raw: SupabaseGame = {
        id: '123',
        title: 'Test Game',
      };
      const result = adapter.toGame(raw);

      expect(result).toEqual({
        id: '123',
        title: 'Test Game',
        platform: 'switch1',
        coverUrl: '',
        releaseDate: '',
      });
    });
  });

  describe('toPriceRecord', () => {
    it('should convert SupabasePrice to PriceRecord type', () => {
      const raw = mockPrices[1]; // Has discount
      const result = adapter.toPriceRecord(raw);

      expect(result).toEqual({
        id: '70010000004989',
        amount: 1253,
        currency: 'TWD',
        regularPrice: 1790,
        discountPrice: 1253,
        discountPercent: 30,
        discountStart: '2024-01-01',
        discountEnd: '2024-12-31',
        salesStatus: 'onsale',
      });
    });

    it('should handle non-sale items', () => {
      const raw = mockPrices[0]; // No discount
      const result = adapter.toPriceRecord(raw);

      expect(result).toEqual({
        id: '70010000000186',
        amount: 1790,
        currency: 'TWD',
        regularPrice: 1790,
        discountPrice: undefined,
        discountPercent: undefined,
        discountStart: undefined,
        discountEnd: undefined,
        salesStatus: 'preorder',
      });
    });
  });

  describe('getAllGames', () => {
    it('should fetch and convert all games', async () => {
      mockOfetch.mockResolvedValueOnce(mockGames);

      const result = await adapter.getAllGames();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('The Legend of Zelda: Breath of the Wild');
      expect(result[1].title).toBe('Super Mario Odyssey');
    });
  });

  describe('getDeals', () => {
    it('should fetch on-sale games with prices', async () => {
      // First call: fetchGames (on-sale)
      mockOfetch.mockResolvedValueOnce([mockGames[1]]);
      // Second call: fetchPrices for game
      mockOfetch.mockResolvedValueOnce([mockPrices[1]]);

      const result = await adapter.getDeals();

      expect(result).toHaveLength(1);
      expect(result[0].game.title).toBe('Super Mario Odyssey');
      expect(result[0].price.discountPrice).toBe(1253);
    });

    it('should skip games without price data', async () => {
      // First call: fetchGames (on-sale)
      mockOfetch.mockResolvedValueOnce([mockGames[1]]);
      // Second call: fetchPrices returns empty
      mockOfetch.mockResolvedValueOnce([]);

      const result = await adapter.getDeals();

      expect(result).toHaveLength(0);
    });
  });
});
