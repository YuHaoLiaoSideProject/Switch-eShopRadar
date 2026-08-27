/**
 * Shared type definitions for Switch eShop Radar.
 * These mirror @eshop/shared types and will be replaced
 * once the shared package is fully established.
 */

export type Platform = 'switch1' | 'switch2';

export type SalesStatus = 'onsale' | 'preorder' | 'unreleased' | 'not_found';

export interface Game {
  id: string;
  title: string;
  platform: Platform;
  coverUrl: string;
  releaseDate: string;
  rating?: number;
}

export interface PriceRecord {
  id: string;
  amount: number;
  currency: 'TWD';
  regularPrice: number;
  salesStatus: SalesStatus;
  discountPrice?: number;
  discountPercent?: number;
  discountStart?: string;
  discountEnd?: string;
  goldPoint?: {
    basicGiftRate: string;
    basicGiftGp: string;
  };
}

export interface Preferences {
  ignoreList: string[];
  wishlist: string[];
}
