import { describe, it, expect } from 'vitest';
import { computeDelta } from '../delta';
import type { PriceSnapshot, PriceRecord } from '@eshop/shared';

const makeRecord = (overrides: Partial<PriceRecord> & { id: string }): PriceRecord => ({
  amount: 179000,
  currency: 'TWD',
  regularPrice: 179000,
  salesStatus: 'onsale',
  ...overrides,
});

describe('computeDelta', () => {
  it('should detect price decrease', () => {
    const old: PriceSnapshot = {
      date: '2025-01-01',
      prices: [makeRecord({ id: 'game-1', amount: 179000, regularPrice: 179000 })],
    };
    const current: PriceSnapshot = {
      date: '2025-01-02',
      prices: [
        makeRecord({
          id: 'game-1',
          amount: 119900,
          regularPrice: 179000,
          discountPrice: 119900,
          discountPercent: 30,
        }),
      ],
    };

    const delta = computeDelta(old, current);

    expect(delta.changes).toHaveLength(1);
    expect(delta.changes[0].id).toBe('game-1');
    expect(delta.changes[0].from.amount).toBe(179000);
    expect(delta.changes[0].to.amount).toBe(119900);
    expect(delta.changes[0].to.discountPercent).toBe(30);
    expect(delta.date).toBe('2025-01-02');
  });

  it('should detect new discount on existing game', () => {
    const old: PriceSnapshot = {
      date: '2025-01-01',
      prices: [
        makeRecord({
          id: 'game-2',
          amount: 249000,
          regularPrice: 249000,
          salesStatus: 'onsale',
        }),
      ],
    };
    const current: PriceSnapshot = {
      date: '2025-01-02',
      prices: [
        makeRecord({
          id: 'game-2',
          amount: 124500,
          regularPrice: 249000,
          discountPrice: 124500,
          discountPercent: 50,
          discountStart: '2025-01-02',
          discountEnd: '2025-01-09',
        }),
      ],
    };

    const delta = computeDelta(old, current);

    expect(delta.changes).toHaveLength(1);
    expect(delta.changes[0].from.discountPrice).toBeUndefined();
    expect(delta.changes[0].to.discountPrice).toBe(124500);
    expect(delta.changes[0].to.discountPercent).toBe(50);
  });

  it('should ignore unchanged prices', () => {
    const old: PriceSnapshot = {
      date: '2025-01-01',
      prices: [makeRecord({ id: 'game-3', amount: 179000 })],
    };
    const current: PriceSnapshot = {
      date: '2025-01-02',
      prices: [makeRecord({ id: 'game-3', amount: 179000 })],
    };

    const delta = computeDelta(old, current);

    expect(delta.changes).toHaveLength(0);
  });

  it('should handle first snapshot (empty old)', () => {
    const old: PriceSnapshot = {
      date: '2025-01-01',
      prices: [],
    };
    const current: PriceSnapshot = {
      date: '2025-01-02',
      prices: [makeRecord({ id: 'new-game-1', amount: 179000 })],
    };

    const delta = computeDelta(old, current);

    expect(delta.changes).toHaveLength(1);
    expect(delta.changes[0].id).toBe('new-game-1');
    expect(delta.changes[0].from).toEqual({});
    expect(delta.changes[0].to.amount).toBe(179000);
  });

  it('should detect price increase (potential fake discount)', () => {
    const old: PriceSnapshot = {
      date: '2025-01-01',
      prices: [
        makeRecord({
          id: 'game-4',
          amount: 150000,
          regularPrice: 150000,
        }),
      ],
    };
    const current: PriceSnapshot = {
      date: '2025-01-02',
      prices: [
        makeRecord({
          id: 'game-4',
          amount: 200000,
          regularPrice: 200000,
          discountPrice: 160000,
          discountPercent: 20,
        }),
      ],
    };

    const delta = computeDelta(old, current);

    expect(delta.changes).toHaveLength(1);
    expect(delta.changes[0].from.amount).toBe(150000);
    expect(delta.changes[0].to.amount).toBe(200000);
    expect(delta.changes[0].to.discountPercent).toBe(20);
  });
});
