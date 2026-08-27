import type { PriceSnapshot } from '@eshop/shared';
import { ofetch } from 'ofetch';
import { TWPriceApi } from '../adapters/price-api';
import { parseNintendoCatalogJson, parseNintendoTWCatalogHtml, type ParsedCatalogEntry } from '../adapters/game-catalog';

// ─── Helpers ────────────────────────────────────────────────

/** Get today's date in YYYY-MM-DD format using Taiwan timezone (UTC+8). */
function getTodayTaiwanDate(): string {
  const now = new Date();
  // UTC+8 offset in milliseconds
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taiwanTime.toISOString().slice(0, 10);
}

// ─── Types ──────────────────────────────────────────────────

export interface FetcherConfig {
  catalogUrl: string;
  priceApiBaseUrl: string;
  country?: string;
  lang?: string;
}

export interface FetchResult {
  snapshot: PriceSnapshot;
  catalog: ParsedCatalogEntry[];
}

// ─── Catalog Fetching ───────────────────────────────────────

/**
 * Detect whether URL points to a JSON catalog endpoint.
 */
function isJsonUrl(url: string): boolean {
  return url.endsWith('.json');
}

/**
 * Fetch the Nintendo software catalog and parse NSUIDs with titles.
 * Supports both JSON API endpoints and HTML pages.
 */
export async function fetchCatalog(url: string): Promise<ParsedCatalogEntry[]> {
  try {
    const response = await ofetch(url, {
      responseType: 'text',
      headers: {
        Accept: isJsonUrl(url) ? 'application/json' : 'text/html',
      },
    });

    const raw = String(response);

    if (isJsonUrl(url)) {
      // Parse as JSON catalog
      const data = JSON.parse(raw);
      return parseNintendoCatalogJson(data);
    }

    // Fallback: parse as HTML (legacy support)
    const lowerHtml = raw.toLowerCase();
    if (!lowerHtml.includes('<html') && !lowerHtml.includes('<body')) {
      throw new Error(
        `Failed to fetch catalog from ${url}: response is not valid HTML (missing <html> or <body> tag)`,
      );
    }

    return parseNintendoTWCatalogHtml(raw);
  } catch (error) {
    // Re-throw known errors as-is; wrap unknown errors
    if (
      error instanceof Error &&
      error.message.startsWith('Failed to fetch catalog from')
    ) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to fetch catalog from ${url}: ${reason}`,
    );
  }
}

// ─── Main Orchestration ────────────────────────────────────

/**
 * Full fetch pipeline:
 * 1. Fetch catalog HTML → parse NSUIDs
 * 2. Batch NSUIDs into chunks of 50
 * 3. Fetch prices for each chunk
 * 4. Assemble PriceSnapshot
 */
export async function runFetch(config: FetcherConfig): Promise<FetchResult> {
  const {
    catalogUrl,
    priceApiBaseUrl,
    lang = 'zh',
  } = config;

  // Step 1: Fetch catalog
  const catalog = await fetchCatalog(catalogUrl);
  const nsuids = catalog.map((g) => g.nsuid);

  if (nsuids.length === 0) {
    return {
      snapshot: {
        date: getTodayTaiwanDate(),
        prices: [],
      },
      catalog,
    };
  }

  // Step 2: Batch fetch prices
  const adapter = new TWPriceApi(priceApiBaseUrl);
  const allPrices = await adapter.fetchPrices(nsuids, lang);

  // Step 3: Filter out games with no price (regularPrice = 0)
  const validPrices = allPrices.filter((p) => p.regularPrice > 0);

  // Step 4: Assemble snapshot
  const snapshot: PriceSnapshot = {
    date: getTodayTaiwanDate(),
    prices: validPrices,
  };

  return { snapshot, catalog };
}
