import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunkArray, BATCH_SIZE } from '../../adapters/price-api';

// ─── Mock ofetch ────────────────────────────────────────────

const mockOfetch = vi.fn();
vi.mock('ofetch', () => ({
  ofetch: (...args: unknown[]) => mockOfetch(...args),
}));

// ─── Imports after mocks ────────────────────────────────────

import { fetchPriceBatch, fetchCatalog, runFetch } from '../fetcher';
import type { NintendoPriceApiResponse } from '../../adapters/price-api';
import type { PriceRecord } from '@eshop/shared';

// ─── Helpers ────────────────────────────────────────────────

function makePriceApiResponse(nsuids: string[]): NintendoPriceApiResponse {
  return {
    personalized: false,
    country: 'TW',
    prices: nsuids.map((id) => ({
      title_id: Number(id),
      sales_status: 'onsale',
      regular_price: {
        amount: `TWD 1790`,
        currency: 'TWD',
        raw_value: '1790',
      },
      discount_price: null,
      gold_point: null,
    })),
  };
}

function makeCatalogHtml(nsuids: string[]): string {
  const links = nsuids
    .map((id) => `<a href="/tw/games/detail/${id}">Game ${id}</a>`)
    .join('\n');
  return `<html><body>${links}</body></html>`;
}

// ─── Tests ──────────────────────────────────────────────────

describe('fetchPriceBatch', () => {
  beforeEach(() => {
    mockOfetch.mockReset();
  });

  it('should fetch prices for a batch of NSUIDs', async () => {
    const nsuids = ['70010000000186', '70010000000200'];
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(nsuids));

    const result = await fetchPriceBatch(nsuids, 'https://api.example.com/v1/price');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('70010000000186');
    expect(result[1].id).toBe('70010000000200');
    expect(mockOfetch).toHaveBeenCalledWith(
      expect.stringContaining('ids=70010000000186,70010000000200'),
    );
  });

  it('should handle API errors gracefully', async () => {
    mockOfetch.mockRejectedValue(new Error('400 Bad Request: error code 4004'));

    await expect(
      fetchPriceBatch(['70010000000186'], 'https://api.example.com/v1/price'),
    ).rejects.toThrow('400');
  });

  it('should retry on transient failures', async () => {
    mockOfetch
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce(makePriceApiResponse(['70010000000186']));

    const result = await fetchPriceBatch(['70010000000186'], 'https://api.example.com/v1/price');

    expect(result).toHaveLength(1);
    expect(mockOfetch).toHaveBeenCalledTimes(3);
  });

  it('should give up after max retries', async () => {
    mockOfetch.mockRejectedValue(new Error('500 Internal Server Error'));

    await expect(
      fetchPriceBatch(['70010000000186'], 'https://api.example.com/v1/price', { retries: 2 }),
    ).rejects.toThrow('500');

    expect(mockOfetch).toHaveBeenCalledTimes(2);
  });

  it('should throw on invalid response shape', async () => {
    mockOfetch.mockResolvedValueOnce({ not_prices: [] });

    await expect(
      fetchPriceBatch(['70010000000186'], 'https://api.example.com/v1/price'),
    ).rejects.toThrow('Invalid API response');
  });

  it('should pass country and lang query params', async () => {
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(['70010000000186']));

    await fetchPriceBatch(['70010000000186'], 'https://api.example.com/v1/price', {
      country: 'JP',
      lang: 'ja',
    });

    expect(mockOfetch).toHaveBeenCalledWith(
      expect.stringContaining('country=JP&lang=ja'),
    );
  });
});

describe('fetchCatalog', () => {
  beforeEach(() => {
    mockOfetch.mockReset();
  });

  it('should fetch HTML and parse NSUIDs', async () => {
    const nsuids = ['70010000000186', '70010000000200'];
    mockOfetch.mockResolvedValueOnce(makeCatalogHtml(nsuids));

    const result = await fetchCatalog('https://www.nintendo.com/tw/software/switch');

    expect(result).toHaveLength(2);
    expect(result.map((g) => g.nsuid)).toEqual(
      expect.arrayContaining(['70010000000186', '70010000000200']),
    );
  });

  it('should return empty array for page with no NSUIDs', async () => {
    mockOfetch.mockResolvedValueOnce('<html><body>No games</body></html>');

    const result = await fetchCatalog('https://www.nintendo.com/tw/software/switch');

    expect(result).toEqual([]);
  });

  it('should throw on fetch failure', async () => {
    mockOfetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchCatalog('https://www.nintendo.com/tw/software/switch')).rejects.toThrow(
      'Network error',
    );
  });
});

describe('runFetch', () => {
  beforeEach(() => {
    mockOfetch.mockReset();
  });

  it('should orchestrate catalog fetch then price fetch', async () => {
    const nsuids = ['70010000000186', '70010000000200'];

    // First call: catalog HTML
    mockOfetch.mockResolvedValueOnce(makeCatalogHtml(nsuids));
    // Second call: price API
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(nsuids));

    const result = await runFetch({
      catalogUrl: 'https://www.nintendo.com/tw/software/switch',
      priceApiBaseUrl: 'https://api.example.com/v1/price',
    });

    expect(result.catalog).toHaveLength(2);
    expect(result.snapshot.prices).toHaveLength(2);
    expect(result.snapshot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return empty snapshot when catalog has no NSUIDs', async () => {
    mockOfetch.mockResolvedValueOnce('<html><body>empty</body></html>');

    const result = await runFetch({
      catalogUrl: 'https://www.nintendo.com/tw/software/switch',
      priceApiBaseUrl: 'https://api.example.com/v1/price',
    });

    expect(result.catalog).toHaveLength(0);
    expect(result.snapshot.prices).toHaveLength(0);
  });

  it('should batch NSUIDs into chunks of 50 for price fetch', async () => {
    // Create 120 NSUIDs to force 3 batches (50 + 50 + 20)
    const nsuids = Array.from({ length: 120 }, (_, i) => `7001${String(i).padStart(10, '0')}`);

    // Catalog HTML
    mockOfetch.mockResolvedValueOnce(makeCatalogHtml(nsuids));
    // 3 price API calls (50 + 50 + 20)
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(nsuids.slice(0, 50)));
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(nsuids.slice(50, 100)));
    mockOfetch.mockResolvedValueOnce(makePriceApiResponse(nsuids.slice(100)));

    const result = await runFetch({
      catalogUrl: 'https://www.nintendo.com/tw/software/switch',
      priceApiBaseUrl: 'https://api.example.com/v1/price',
    });

    expect(result.snapshot.prices).toHaveLength(120);
    // Catalog + 3 price batches = 4 ofetch calls
    expect(mockOfetch).toHaveBeenCalledTimes(4);
  });
});

describe('chunkArray (fetcher usage)', () => {
  it('should split 120 items into 3 chunks (50+50+20)', () => {
    const arr = Array.from({ length: 120 }, (_, i) => i);
    const chunks = chunkArray(arr, BATCH_SIZE);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(50);
    expect(chunks[2]).toHaveLength(20);
  });

  it('should handle fewer items than batch size', () => {
    const arr = ['a', 'b', 'c'];
    const chunks = chunkArray(arr, BATCH_SIZE);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(['a', 'b', 'c']);
  });

  it('should handle exactly 50 items', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const chunks = chunkArray(arr, BATCH_SIZE);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(50);
  });

  it('should handle exactly 51 items (2 batches)', () => {
    const arr = Array.from({ length: 51 }, (_, i) => i);
    const chunks = chunkArray(arr, BATCH_SIZE);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(1);
  });

  it('should handle empty array', () => {
    expect(chunkArray([], BATCH_SIZE)).toEqual([]);
  });
});
