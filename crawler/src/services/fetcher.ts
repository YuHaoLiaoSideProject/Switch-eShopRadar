import type { PriceRecord, PriceSnapshot, Game } from '@eshop/shared';
import { ofetch } from 'ofetch';
import * as cheerio from 'cheerio';
import {
  TWPriceApi,
  parsePriceEntry,
  chunkArray,
  BATCH_SIZE,
  type NintendoPriceApiResponse,
} from '../adapters/price-api';
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

// ─── Price Batch Fetching ──────────────────────────────────

/**
 * Fetch prices for a batch of NSUIDs from the Nintendo Price API.
 * Retries on transient failures (network errors, 5xx).
 */
export async function fetchPriceBatch(
  nsuids: string[],
  baseUrl: string,
  options: { country?: string; lang?: string; retries?: number } = {},
): Promise<PriceRecord[]> {
  const { country = 'TW', lang = 'zh', retries = 3 } = options;
  const idsParam = nsuids.join(',');
  const url = `${baseUrl}?country=${country}&lang=${lang}&ids=${idsParam}`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ofetch<NintendoPriceApiResponse>(url);

      if (!response || !Array.isArray(response.prices)) {
        throw new Error('Invalid API response: missing prices array');
      }

      return response.prices.map(parsePriceEntry);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on client errors (4xx) except 429 rate limit
      const msg = lastError.message.toLowerCase();
      if (
        (msg.includes('400') || msg.includes('4004')) &&
        !msg.includes('429')
      ) {
        throw lastError;
      }

      if (attempt < retries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError ?? new Error('fetchPriceBatch failed after retries');
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
    country = 'TW',
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
  const chunks = chunkArray(nsuids, BATCH_SIZE);
  const allPrices: PriceRecord[] = [];

  for (const chunk of chunks) {
    const prices = await fetchPriceBatch(chunk, priceApiBaseUrl, { country, lang });
    allPrices.push(...prices);

    // Rate limit between batches
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Step 3: Assemble snapshot
  const snapshot: PriceSnapshot = {
    date: new Date().toISOString().slice(0, 10),
    prices: allPrices,
  };

  return { snapshot, catalog };
}
