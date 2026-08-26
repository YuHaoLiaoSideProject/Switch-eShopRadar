/**
 * Shared type definitions for Switch eShop Radar.
 * These mirror @eshop/shared types and will be replaced
 * once the shared package is fully established.
 */

export type Platform = 'switch1' | 'switch2';

export type SalesStatus = 'onsale' | 'preorder' | 'unreleased' | 'unavailable';

export interface Game {
  id: string;
  title: string;
  platform: Platform;
  coverUrl: string;
  releaseDate: string;
}

export interface PriceRecord {
  id: string;
  amount: number;
  currency: string;
  regularPrice: number;
  salesStatus: SalesStatus;
  discountPrice?: number;
  discountStart?: string;
  discountEnd?: string;
}

export interface Preferences {
  ignoreList: string[];
  wishlist: string[];
}

export interface GameWithPrice extends Game {
  price: PriceRecord | null;
}
