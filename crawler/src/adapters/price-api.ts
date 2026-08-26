import type { PriceRecord } from '@eshop/shared';
import { ofetch } from 'ofetch';

// ─── Adapter Interface ──────────────────────────────────────

export interface PriceAdapter {
  fetchPrices(nsuids: string[], lang?: string): Promise<PriceRecord[]>;
}

// ─── Raw API Response Shape (real Nintendo Price API) ──────

/** Shape returned by GET /v1/price?country=TW&lang=zh&ids=... */
export interface NintendoPriceApiResponse {
  personalized: boolean;
  country: string;
  prices: NintendoPriceEntry[];
}

export interface NintendoPriceEntry {
  title_id: number;
  sales_status: string;
  regular_price: {
    amount: string; // e.g. "TWD 630"
    currency: string; // "TWD"
    raw_value: string; // "630"
  } | null;
  discount_price: {
    amount: string;
    currency: string;
    raw_value: string;
    start_datetime: string;
    end_datetime: string;
  } | null;
  gold_point: {
    basic_gift_gp: string;
    basic_gift_rate: string;
    consume_gp: string;
    gift_gp: string;
    gift_rate: string;
  } | null;
}

// ─── Batch Configuration ────────────────────────────────────

export const BATCH_SIZE = 50;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 200;

// ─── Parser ─────────────────────────────────────────────────

/**
 * Parse a single Nintendo price entry from the real API format into our PriceRecord.
 */
export function parsePriceEntry(entry: NintendoPriceEntry): PriceRecord {
  const nsuid = String(entry.title_id);
  const regularPrice = entry.regular_price ? parseInt(entry.regular_price.raw_value, 10) : 0;
  const discountRaw = entry.discount_price ? parseInt(entry.discount_price.raw_value, 10) : undefined;
  const hasDiscount = discountRaw !== undefined && discountRaw > 0 && discountRaw < regularPrice;

  // Calculate discount percent from prices
  let discountPercent: number | undefined;
  if (hasDiscount && regularPrice > 0) {
    discountPercent = Math.round(((regularPrice - discountRaw!) / regularPrice) * 100);
  }

  return {
    id: nsuid,
    amount: hasDiscount ? discountRaw! : regularPrice,
    currency: 'TWD',
    regularPrice,
    discountPrice: hasDiscount ? discountRaw : undefined,
    discountPercent,
    discountStart: entry.discount_price?.start_datetime,
    discountEnd: entry.discount_price?.end_datetime,
    salesStatus: entry.sales_status as PriceRecord['salesStatus'],
    goldPoint: entry.gold_point
      ? {
          basicGiftRate: entry.gold_point.basic_gift_rate,
          basicGiftGp: entry.gold_point.basic_gift_gp,
        }
      : undefined,
  };
}

// ─── Sleep helper ───────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Batch fetching ─────────────────────────────────────────

/**
 * Split an array into chunks of the given size.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch prices for a batch of NSUIDs from the Nintendo Price API.
 * Includes retry logic for transient failures and rate limiting.
 */
export async function fetchPriceBatch(
  nsuids: string[],
  baseUrl: string,
  options: { country?: string; lang?: string } = {},
): Promise<PriceRecord[]> {
  const { country = 'TW', lang = 'zh' } = options;
  const idsParam = nsuids.join(',');
  const url = `${baseUrl}?country=${country}&lang=${lang}&ids=${idsParam}`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await ofetch<NintendoPriceApiResponse>(url);

      if (!response || !Array.isArray(response.prices)) {
        throw new Error(`Invalid API response: missing prices array`);
      }

      return response.prices.map(parsePriceEntry);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on client errors (4xx except 429)
      if (lastError.message.includes('4004') || lastError.message.includes('400')) {
        throw lastError;
      }

      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError ?? new Error('fetchPriceBatch failed after retries');
}

// ─── TW Price API Adapter ──────────────────────────────────

export class TWPriceApi implements PriceAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://api.ec.nintendo.com/v1/price') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch prices for a list of NSUIDs, automatically batching into chunks of 50.
   * Includes rate limiting between batches.
   */
  async fetchPrices(nsuids: string[], _lang: string = 'zh'): Promise<PriceRecord[]> {
    const chunks = chunkArray(nsuids, BATCH_SIZE);
    const allPrices: PriceRecord[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prices = await fetchPriceBatch(chunk, this.baseUrl);
      allPrices.push(...prices);

      // Rate limit between batches (not after the last one)
      if (i < chunks.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    return allPrices;
  }
}
