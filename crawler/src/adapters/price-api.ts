import { type PriceRecord, computeDiscountPercent } from '@eshop/shared';
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

const VALID_STATUSES = ['onsale', 'preorder', 'unreleased', 'not_found'] as const;

/**
 * Parse a single Nintendo price entry from the real API format into our PriceRecord.
 */
export function parsePriceEntry(entry: NintendoPriceEntry): PriceRecord {
  const nsuid = String(entry.title_id);
  const regularPrice = entry.regular_price ? parseInt(entry.regular_price.raw_value, 10) : 0;
  const discountRaw = entry.discount_price ? parseInt(entry.discount_price.raw_value, 10) : undefined;
  const hasDiscount = discountRaw !== undefined && discountRaw > 0 && discountRaw < regularPrice;

  // Calculate discount percent from prices
  const discountPercent = hasDiscount ? computeDiscountPercent(regularPrice, discountRaw!) : undefined;

  const salesStatus = VALID_STATUSES.includes(entry.sales_status as (typeof VALID_STATUSES)[number])
    ? (entry.sales_status as PriceRecord['salesStatus'])
    : 'not_found';

  return {
    id: nsuid,
    amount: hasDiscount ? discountRaw! : regularPrice,
    currency: 'TWD',
    regularPrice,
    discountPrice: hasDiscount ? discountRaw : undefined,
    discountPercent,
    discountStart: entry.discount_price?.start_datetime,
    discountEnd: entry.discount_price?.end_datetime,
    salesStatus,
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
 * Extract HTTP status code from an error, trying ofetch FetchError properties
 * first, then falling back to regex matching on the message.
 */
function getHttpStatus(err: Error): number | undefined {
  // ofetch FetchError exposes .status and .response?.status
  const anyErr = err as unknown as Record<string, unknown>;
  if (typeof anyErr.status === 'number') return anyErr.status as number;
  const resp = anyErr.response as { status?: number } | undefined;
  if (resp && typeof resp.status === 'number') return resp.status;

  // Fallback: regex for 3-digit HTTP status codes in the message
  const match = err.message.match(/\b([45]\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Fetch prices for a batch of NSUIDs from the Nintendo Price API.
 * Includes retry logic for transient failures and rate limiting.
 */
export async function fetchPriceBatch(
  nsuids: string[],
  baseUrl: string,
  options: { country?: string; lang?: string; retries?: number } = {},
): Promise<PriceRecord[]> {
  const { country = 'TW', lang = 'zh', retries = RETRY_ATTEMPTS } = options;
  const idsParam = nsuids.join(',');
  const url = `${baseUrl}?country=${country}&lang=${lang}&ids=${idsParam}`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ofetch<NintendoPriceApiResponse>(url);

      if (!response || !Array.isArray(response.prices)) {
        throw new Error(`Invalid API response: missing prices array`);
      }

      return response.prices.map(parsePriceEntry);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on client errors (4xx except 429 rate limit)
      const status = getHttpStatus(lastError);
      if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
        throw lastError;
      }

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError ?? new Error('fetchPriceBatch failed after retries');
}

// ─── TW Price API Adapter ──────────────────────────────────

export class TWPriceApi implements PriceAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
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
