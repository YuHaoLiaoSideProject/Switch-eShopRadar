/**
 * Switch-Games.com Adapter
 *
 * Fallback data source using Supabase PostgREST API.
 * This adapter queries switch-games.com's internal Supabase backend
 * for game catalog and price data.
 *
 * ⚠️ Warning: This is an unofficial, private API endpoint.
 * Stability is not guaranteed — the endpoint may change without notice.
 *
 * @see docs/switch-games-api-analysis.md for full analysis
 */

import { ofetch } from 'ofetch';
import type { Game, PriceRecord } from '@eshop/shared';
import { computeDiscountPercent } from '@eshop/shared';

// ─── Configuration ──────────────────────────────────────────

export interface SwitchGamesConfig {
  /** Supabase project URL, e.g. "https://xxx.supabase.co" */
  supabaseUrl: string;
  /** Supabase anon key (public client key) */
  anonKey: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

// ─── Raw Supabase Response Types ────────────────────────────

/** Raw game record from Supabase */
export interface SupabaseGame {
  id: string;
  title: string;
  publisher?: string;
  cover_url?: string;
  release_date?: string;
  has_traditional_chinese?: boolean;
  on_sale?: boolean;
  discount_rate?: number;
  platform?: string;
  /** Additional fields may exist depending on schema */
  [key: string]: unknown;
}

/** Raw price record from Supabase */
export interface SupabasePrice {
  id: string;
  game_id: string;
  country: string;
  currency: string;
  regular_price: number;
  discount_price?: number;
  on_sale?: boolean;
  discount_start?: string;
  discount_end?: string;
  /** Additional fields may exist depending on schema */
  [key: string]: unknown;
}

// ─── Adapter Class ──────────────────────────────────────────

export class SwitchGamesAdapter {
  private readonly config: SwitchGamesConfig;
  private readonly timeoutMs: number;

  constructor(config: SwitchGamesConfig) {
    this.config = config;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  // ─── HTTP Helpers ───────────────────────────────────────

  private get headers() {
    return {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  private get restBaseUrl() {
    return `${this.config.supabaseUrl}/rest/v1`;
  }

  // ─── Game Catalog Methods ──────────────────────────────

  /**
   * Fetch games from switch-games.com with optional filters.
   */
  async fetchGames(options: {
    /** Filter by title (partial match) */
    title?: string;
    /** Only games with Traditional Chinese support */
    hasChinese?: boolean;
    /** Only games currently on sale */
    onSale?: boolean;
    /** Maximum number of results */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
    /** Sort field and direction */
    orderBy?: string;
  } = {}): Promise<SupabaseGame[]> {
    const params = new URLSearchParams();

    // Select all columns by default
    params.set('select', '*');

    // Apply filters
    if (options.title) {
      params.set('title', `ilike.*${options.title}*`);
    }
    if (options.hasChinese === true) {
      params.set('has_traditional_chinese', 'eq.true');
    }
    if (options.onSale === true) {
      params.set('on_sale', 'eq.true');
    }

    // Pagination
    if (options.limit) {
      params.set('limit', String(options.limit));
    }
    if (options.offset) {
      params.set('offset', String(options.offset));
    }

    // Sorting
    if (options.orderBy) {
      params.set('order', options.orderBy);
    } else {
      params.set('order', 'title.asc');
    }

    const url = `${this.restBaseUrl}/games?${params.toString()}`;

    try {
      const response = await ofetch<SupabaseGame[]>(url, {
        headers: this.headers,
        timeout: this.timeoutMs,
      });
      return Array.isArray(response) ? response : [];
    } catch (err) {
      console.error('[switch-games] Failed to fetch games:', err);
      return [];
    }
  }

  /**
   * Search games by keyword.
   */
  async searchGames(keyword: string, limit = 20): Promise<SupabaseGame[]> {
    return this.fetchGames({ title: keyword, limit });
  }

  /**
   * Get games with Traditional Chinese support.
   */
  async getChineseGames(limit = 50): Promise<SupabaseGame[]> {
    return this.fetchGames({ hasChinese: true, limit });
  }

  /**
   * Get games currently on sale.
   */
  async getOnSaleGames(limit = 50): Promise<SupabaseGame[]> {
    return this.fetchGames({ onSale: true, limit, orderBy: 'discount_rate.desc' });
  }

  // ─── Price Methods ─────────────────────────────────────

  /**
   * Fetch prices from switch-games.com.
   */
  async fetchPrices(options: {
    gameId?: string;
    country?: string;
    onSale?: boolean;
    limit?: number;
  } = {}): Promise<SupabasePrice[]> {
    const params = new URLSearchParams();

    params.set('select', '*');

    if (options.gameId) {
      params.set('game_id', `eq.${options.gameId}`);
    }
    if (options.country) {
      params.set('country', `eq.${options.country}`);
    }
    if (options.onSale === true) {
      params.set('on_sale', 'eq.true');
    }
    if (options.limit) {
      params.set('limit', String(options.limit));
    }

    const url = `${this.restBaseUrl}/prices?${params.toString()}`;

    try {
      const response = await ofetch<SupabasePrice[]>(url, {
        headers: this.headers,
        timeout: this.timeoutMs,
      });
      return Array.isArray(response) ? response : [];
    } catch (err) {
      console.error('[switch-games] Failed to fetch prices:', err);
      return [];
    }
  }

  // ─── Conversion Helpers ────────────────────────────────

  /**
   * Convert SupabaseGame to our Game type.
   * Note: ID mapping may need adjustment based on actual schema.
   */
  toGame(raw: SupabaseGame): Game {
    const isValidNsuid = /^700[17]\d{10}$/.test(raw.id);
    if (!isValidNsuid) {
      console.warn(`[switch-games] ⚠️ raw.id "${raw.id}" does not match NSUID pattern — using as-is`);
    }

    return {
      id: raw.id,
      title: raw.title ?? 'Unknown',
      platform: 'switch1', // Default, as switch-games.com may not distinguish
      coverUrl: raw.cover_url ?? '',
      releaseDate: raw.release_date ?? '',
    };
  }

  /**
   * Convert SupabasePrice to our PriceRecord type.
   * Note: Currency and ID mapping may need adjustment.
   */
  toPriceRecord(raw: SupabasePrice): PriceRecord {
    const regularPrice = raw.regular_price ?? 0;
    const discountPrice = raw.discount_price;
    const hasDiscount = discountPrice !== undefined && discountPrice !== null && discountPrice < regularPrice;

    return {
      id: raw.game_id ?? raw.id,
      amount: hasDiscount ? discountPrice! : regularPrice,
      currency: 'TWD', // Default, actual currency depends on source
      regularPrice,
      discountPrice: hasDiscount ? discountPrice : undefined,
      discountPercent: hasDiscount ? computeDiscountPercent(regularPrice, discountPrice!) : undefined,
      discountStart: raw.discount_start,
      discountEnd: raw.discount_end,
      salesStatus: raw.on_sale ? 'onsale' : raw.regular_price > 0 ? 'preorder' : 'not_found',
    };
  }

  // ─── Convenience Methods ───────────────────────────────

  /**
   * Fetch all games and convert to Game[] type.
   */
  async getAllGames(limit = 100): Promise<Game[]> {
    const rawGames = await this.fetchGames({ limit });
    return rawGames.map((g) => this.toGame(g));
  }

  /**
   * Fetch on-sale games and convert to Game[] with price info.
   *
   * @deprecated This method issues one HTTP request per game (N+1).
   * Use `fetchGames({ onSale: true })` + `fetchPrices({ onSale: true })`
   * instead and join the results in memory.
   */
  async getDeals(limit = 50): Promise<{ game: Game; price: PriceRecord }[]> {
    console.warn('[switch-games] ⚠️ getDeals() is deprecated — it makes N separate HTTP requests for N games. Use bulk fetchGames + fetchPrices instead.');

    const rawGames = await this.fetchGames({ onSale: true, limit });
    const results: { game: Game; price: PriceRecord }[] = [];

    for (const rawGame of rawGames) {
      const game = this.toGame(rawGame);
      // Try to fetch price for this game
      const prices = await this.fetchPrices({ gameId: rawGame.id, limit: 1 });
      if (prices.length > 0) {
        results.push({ game, price: this.toPriceRecord(prices[0]) });
      }
    }

    return results;
  }
}

// ─── Environment-based Factory ──────────────────────────────

/**
 * Create a SwitchGamesAdapter from environment variables.
 * Returns null if required env vars are missing.
 */
export function createSwitchGamesAdapterFromEnv(): SwitchGamesAdapter | null {
  const supabaseUrl = process.env.SWITCH_GAMES_SUPABASE_URL;
  const anonKey = process.env.SWITCH_GAMES_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.log('[switch-games] Missing SWITCH_GAMES_SUPABASE_URL or SWITCH_GAMES_ANON_KEY — adapter disabled');
    return null;
  }

  return new SwitchGamesAdapter({ supabaseUrl, anonKey });
}
