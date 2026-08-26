import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Game,
  PriceRecord,
  PriceSnapshot,
  PriceDelta,
  GameCatalog,
} from '../index';

describe('Shared type definitions', () => {
  it('Game should have required fields', () => {
    expectTypeOf<Game>().toHaveProperty('id');
    expectTypeOf<Game>().toHaveProperty('title');
    expectTypeOf<Game>().toHaveProperty('platform');
    expectTypeOf<Game>().toHaveProperty('coverUrl');
    expectTypeOf<Game>().toHaveProperty('releaseDate');
    expectTypeOf<Game>().toHaveProperty('rating');
  });

  it('Game.platform should be a union of switch1 | switch2', () => {
    expectTypeOf<Game['platform']>().toEqualTypeOf<'switch1' | 'switch2'>();
  });

  it('PriceRecord should have correct salesStatus union', () => {
    expectTypeOf<PriceRecord['salesStatus']>().toEqualTypeOf<
      'onsale' | 'preorder' | 'unreleased' | 'not_found'
    >();
  });

  it('PriceRecord.currency should be TWD', () => {
    expectTypeOf<PriceRecord['currency']>().toEqualTypeOf<'TWD'>();
  });

  it('PriceSnapshot should have date and prices array', () => {
    expectTypeOf<PriceSnapshot>().toHaveProperty('date');
    expectTypeOf<PriceSnapshot>().toHaveProperty('prices');
    expectTypeOf<PriceSnapshot['prices']>().toEqualTypeOf<PriceRecord[]>();
  });

  it('PriceDelta should have date and changes array', () => {
    expectTypeOf<PriceDelta>().toHaveProperty('date');
    expectTypeOf<PriceDelta>().toHaveProperty('changes');
  });

  it('GameCatalog should have updatedAt and games array', () => {
    expectTypeOf<GameCatalog>().toHaveProperty('updatedAt');
    expectTypeOf<GameCatalog>().toHaveProperty('games');
    expectTypeOf<GameCatalog['games']>().toEqualTypeOf<Game[]>();
  });

  it('should construct a valid Game literal', () => {
    const game: Game = {
      id: '70010000000186',
      title: 'Test Game',
      platform: 'switch1',
      coverUrl: 'https://example.com/cover.jpg',
      releaseDate: '2025-01-15',
    };
    expect(game.id).toBe('70010000000186');
  });

  it('should construct a valid PriceRecord literal', () => {
    const price: PriceRecord = {
      id: '70010000000186',
      amount: 179000,
      currency: 'TWD',
      regularPrice: 179000,
      discountPrice: 119900,
      discountPercent: 30,
      salesStatus: 'onsale',
    };
    expect(price.currency).toBe('TWD');
  });
});
