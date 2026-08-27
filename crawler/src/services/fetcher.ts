import type { PriceRecord, PriceSnapshot } from '@eshop/shared';
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
  const html = await ofetch<string>(url, { responseType: 'text' });
  return parseNintendoTWCatalogHtml(html);
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
