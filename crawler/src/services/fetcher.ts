import type { PriceSnapshot } from '@eshop/shared';
import { ofetch } from 'ofetch';
import { TWPriceApi } from '../adapters/price-api';
import { parseNintendoCatalogJson, parseNintendoTWCatalogHtml, type ParsedCatalogEntry } from '../adapters/game-catalog';
import { SwitchGamesAdapter, type SwitchGamesConfig } from '../adapters/switch-games';

// ─── Helpers ────────────────────────────────────────────────

/** Get today's date in YYYY-MM-DD format using Taiwan timezone (UTC+8). */
function getTodayTaiwanDate(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
}

// ─── Types ──────────────────────────────────────────────────

export interface FetcherConfig {
  catalogUrl: string;
  priceApiBaseUrl: string;
  country?: string;
  lang?: string;
  coverCdn?: string;
  switchGames?: SwitchGamesConfig;
}

export interface FetchResult {
  snapshot: PriceSnapshot;
  catalog: ParsedCatalogEntry[];
}

// ─── Catalog Fetching (Nintendo) ───────────────────────────

function isJsonUrl(url: string): boolean {
  return url.endsWith('.json');
}

export async function fetchCatalog(url: string): Promise<ParsedCatalogEntry[]> {
  try {
    const response = await ofetch(url, {
      responseType: 'text',
      headers: { Accept: isJsonUrl(url) ? 'application/json' : 'text/html' },
    });
    const raw = String(response);
    return isJsonUrl(url)
      ? parseNintendoCatalogJson(JSON.parse(raw))
      : parseNintendoTWCatalogHtml(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch catalog from ${url}: ${reason}`);
  }
}

// ─── Switch-Games.com (Primary) ────────────────────────────

async function fetchSwitchGames(
  config: SwitchGamesConfig,
  coverCdn?: string,
): Promise<FetchResult | null> {
  try {
    const adapter = new SwitchGamesAdapter(config);
    const rawGames = await adapter.fetchGames({ limit: 1000 });
    if (rawGames.length >= 1000) {
      console.warn('[fetcher] ⚠️ Switch-Games.com games hit 1000 limit — may be truncated');
    }
    if (rawGames.length === 0) return null;

    const rawPrices = await adapter.fetchPrices({ limit: 1000, country: 'TW' });
    if (rawPrices.length >= 1000) {
      console.warn('[fetcher] ⚠️ Switch-Games.com prices hit 1000 limit — may be truncated');
    }
    const prices = rawPrices
      .map((p) => adapter.toPriceRecord(p))
      .filter((p) => p.regularPrice > 0);

    // Use Nintendo HK cover art instead of Switch-Games.com's banner images
    const nintendoCdn = coverCdn ?? 'https://store.nintendo.com.hk/media/catalog/product';

    return {
      snapshot: { date: getTodayTaiwanDate(), prices },
      catalog: rawGames.map((g) => ({
        nsuid: g.id,
        title: g.title,
        coverUrl: `${nintendoCdn}/${g.id}.jpg`,
        releaseDate: g.release_date ?? '',
      })),
    };
  } catch (err) {
    console.error('[fetcher] Switch-Games.com failed:', err);
    return null;
  }
}

// ─── Nintendo API (Fallback) ───────────────────────────────

async function fetchNintendoApi(config: FetcherConfig): Promise<FetchResult> {
  const catalog = await fetchCatalog(config.catalogUrl);
  const nsuids = catalog.map((g) => g.nsuid);

  const prices = nsuids.length > 0
    ? (await new TWPriceApi(config.priceApiBaseUrl).fetchPrices(nsuids, config.lang))
        .filter((p) => p.regularPrice > 0)
    : [];

  return { snapshot: { date: getTodayTaiwanDate(), prices }, catalog };
}

// ─── Main ──────────────────────────────────────────────────

/**
 * Fetch with fallback: Switch-Games.com → Nintendo API.
 */
export async function runFetch(config: FetcherConfig): Promise<FetchResult> {
  // 1. Try Switch-Games.com
  if (config.switchGames?.supabaseUrl && config.switchGames?.anonKey) {
    const result = await fetchSwitchGames(config.switchGames, config.coverCdn);
    if (result) {
      console.log(`[fetcher] ✅ Switch-Games.com: ${result.catalog.length} games, ${result.snapshot.prices.length} prices`);
      return result;
    }
    console.log('[fetcher] ⚠️ Switch-Games.com unavailable, falling back to Nintendo API');
  }

  // 2. Fallback to Nintendo API
  const result = await fetchNintendoApi(config);
  console.log(`[fetcher] ✅ Nintendo API: ${result.catalog.length} games, ${result.snapshot.prices.length} prices`);
  return result;
}
