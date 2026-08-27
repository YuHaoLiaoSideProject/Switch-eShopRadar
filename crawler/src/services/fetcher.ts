import type { PriceSnapshot } from '@eshop/shared';
import { ofetch } from 'ofetch';
import { TWPriceApi } from '../adapters/price-api';
import { parseNintendoTWCatalogHtml, type ParsedCatalogEntry } from '../adapters/game-catalog';

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
 * Fetch the Nintendo TW software catalog HTML and parse NSUIDs from it.
 */
export async function fetchCatalog(url: string): Promise<ParsedCatalogEntry[]> {
  try {
    const response = await ofetch(url, {
      responseType: 'text',
      headers: { Accept: 'text/html' },
    });

    const html = String(response);

    // Basic HTML content validation
    const lowerHtml = html.toLowerCase();
    if (!lowerHtml.includes('<html') && !lowerHtml.includes('<body')) {
      throw new Error(
        `Failed to fetch catalog from ${url}: response is not valid HTML (missing <html> or <body> tag)`,
      );
    }

    return parseNintendoTWCatalogHtml(html);
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
        date: new Date().toISOString().slice(0, 10),
        prices: [],
      },
      catalog,
    };
  }

  // Step 2: Batch fetch prices
  const adapter = new TWPriceApi(priceApiBaseUrl);
  const allPrices = await adapter.fetchPrices(nsuids, lang);

  // Step 3: Assemble snapshot
  const snapshot: PriceSnapshot = {
    date: new Date().toISOString().slice(0, 10),
    prices: allPrices,
  };

  return { snapshot, catalog };
}
