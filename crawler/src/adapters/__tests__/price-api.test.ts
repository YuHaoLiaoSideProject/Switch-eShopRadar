import { describe, it, expect } from 'vitest';
import { parsePriceEntry, chunkArray, type NintendoPriceEntry } from '../price-api';

// ─── Helpers ────────────────────────────────────────────────

function makeEntry(overrides: Partial<NintendoPriceEntry> & { title_id: number }): NintendoPriceEntry {
  return {
    title_id: overrides.title_id,
    sales_status: 'onsale',
    regular_price: {
      amount: 'TWD 1790',
      currency: 'TWD',
      raw_value: '1790',
    },
    discount_price: null,
    gold_point: null,
    ...overrides,
  };
}

// ─── parsePriceEntry tests ──────────────────────────────────

describe('parsePriceEntry', () => {
  it('should parse on-sale game with discount', () => {
    const entry = makeEntry({
      title_id: 70010000000186,
      regular_price: {
        amount: 'TWD 1790',
        currency: 'TWD',
        raw_value: '1790',
      },
      discount_price: {
        amount: 'TWD 1199',
        currency: 'TWD',
        raw_value: '1199',
        start_datetime: '2025-01-15T06:00:00',
        end_datetime: '2025-02-15T05:59:59',
      },
      sales_status: 'onsale',
      gold_point: {
        basic_gift_rate: '5%',
        basic_gift_gp: '59',
        consume_gp: '0',
        gift_gp: '0',
        gift_rate: '0',
      },
    });

    const result = parsePriceEntry(entry);

    expect(result.id).toBe('70010000000186');
    expect(result.amount).toBe(1199);
    expect(result.currency).toBe('TWD');
    expect(result.regularPrice).toBe(1790);
    expect(result.discountPrice).toBe(1199);
    expect(result.discountPercent).toBe(33); // (1790-1199)/1790 ≈ 33%
    expect(result.discountStart).toBe('2025-01-15T06:00:00');
    expect(result.discountEnd).toBe('2025-02-15T05:59:59');
    expect(result.salesStatus).toBe('onsale');
    expect(result.goldPoint).toEqual({
      basicGiftRate: '5%',
      basicGiftGp: '59',
    });
  });

  it('should parse game without discount', () => {
    const entry = makeEntry({
      title_id: 70010000000200,
      regular_price: {
        amount: 'TWD 1790',
        currency: 'TWD',
        raw_value: '1790',
      },
      discount_price: null,
      sales_status: 'onsale',
      gold_point: null,
    });

    const result = parsePriceEntry(entry);

    expect(result.id).toBe('70010000000200');
    expect(result.amount).toBe(1790);
    expect(result.regularPrice).toBe(1790);
    expect(result.discountPrice).toBeUndefined();
    expect(result.discountPercent).toBeUndefined();
    expect(result.discountStart).toBeUndefined();
    expect(result.discountEnd).toBeUndefined();
    expect(result.salesStatus).toBe('onsale');
    expect(result.goldPoint).toBeUndefined();
  });

  it('should handle not_found sales_status', () => {
    const entry = makeEntry({
      title_id: 99999999999999,
      regular_price: null,
      discount_price: null,
      sales_status: 'not_found',
    });

    const result = parsePriceEntry(entry);

    expect(result.id).toBe('99999999999999');
    expect(result.amount).toBe(0);
    expect(result.regularPrice).toBe(0);
    expect(result.salesStatus).toBe('not_found');
  });

  it('should parse gold_point correctly', () => {
    const entry = makeEntry({
      title_id: 70010000000300,
      sales_status: 'onsale',
      gold_point: {
        basic_gift_rate: '5%',
        basic_gift_gp: '89',
        consume_gp: '0',
        gift_gp: '0',
        gift_rate: '0',
      },
    });

    const result = parsePriceEntry(entry);

    expect(result.goldPoint).toBeDefined();
    expect(result.goldPoint!.basicGiftRate).toBe('5%');
    expect(result.goldPoint!.basicGiftGp).toBe('89');
  });

  it('should convert title_id number to string nsuid', () => {
    const entry = makeEntry({ title_id: 70010000054199 });

    const result = parsePriceEntry(entry);

    expect(result.id).toBe('70010000054199');
  });

  it('should handle discount where discount_price equals regular_price (no real discount)', () => {
    const entry = makeEntry({
      title_id: 70010000000500,
      regular_price: {
        amount: 'TWD 1790',
        currency: 'TWD',
        raw_value: '1790',
      },
      discount_price: {
        amount: 'TWD 1790',
        currency: 'TWD',
        raw_value: '1790',
        start_datetime: '2025-01-01',
        end_datetime: '2025-12-31',
      },
      sales_status: 'onsale',
    });

    const result = parsePriceEntry(entry);

    // Same price = no effective discount
    expect(result.discountPrice).toBeUndefined();
    expect(result.discountPercent).toBeUndefined();
    expect(result.amount).toBe(1790);
  });

  it('should handle preorder status', () => {
    const entry = makeEntry({
      title_id: 70010000000600,
      sales_status: 'preorder',
      regular_price: {
        amount: 'TWD 1790',
        currency: 'TWD',
        raw_value: '1790',
      },
    });

    const result = parsePriceEntry(entry);

    expect(result.salesStatus).toBe('preorder');
    expect(result.amount).toBe(1790);
  });

  it('should handle unreleased status', () => {
    const entry = makeEntry({
      title_id: 70010000000700,
      sales_status: 'unreleased',
      regular_price: null,
      discount_price: null,
    });

    const result = parsePriceEntry(entry);

    expect(result.salesStatus).toBe('unreleased');
    expect(result.amount).toBe(0);
  });
});

// ─── chunkArray tests ───────────────────────────────────────

describe('chunkArray', () => {
  it('should split array into chunks of given size', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should return single chunk when array fits', () => {
    const arr = [1, 2, 3];
    expect(chunkArray(arr, 5)).toEqual([[1, 2, 3]]);
  });

  it('should return empty array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it('should handle exact multiple', () => {
    const arr = [1, 2, 3, 4];
    expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4]]);
  });
});
