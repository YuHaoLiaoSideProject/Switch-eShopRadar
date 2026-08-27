/**
 * Shared type definitions for Switch eShop Radar.
 *
 * Game and PriceRecord are re-exported from @eshop/shared
 * to keep a single source of truth. Platform, SalesStatus,
 * and Preferences are web-specific convenience aliases.
 */

export type { Game, PriceRecord } from '@eshop/shared';

// ─── Web-specific aliases ─────────────────────────────────────

export type Platform = 'switch1' | 'switch2';

export type SalesStatus = 'onsale' | 'preorder' | 'unreleased' | 'not_found';

// ─── Preferences (web-only) ──────────────────────────────────

export interface Preferences {
  ignoreList: string[];
  wishlist: string[];
}
