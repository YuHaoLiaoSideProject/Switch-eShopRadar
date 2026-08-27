import type { Game, PriceRecord } from '@/types';
import type { PriceSnapshot, PriceDelta } from '@eshop/shared';

const BASE_DATA_URL = './data';
const TIMEOUT_MS = 10_000;

// ─── Internal Types (matching crawler output) ───────────────

/** A single price record with only the changed fields populated. */
export type PartialPriceRecord = Pick<PriceRecord, 'id'> & Partial<PriceRecord>;

// ─── Helpers ────────────────────────────────────────────────

/** Thrown when the server responds with 404 (data not yet available). */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found: ${url}`);
    this.name = 'NotFoundError';
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: signal ?? controller.signal });
    if (response.status === 404) {
      throw new NotFoundError(url);
    }
    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Try to fetch JSON, return fallback for 404 (expected: data not yet generated).
 * Re-throws network/server errors after logging a warning.
 */
async function fetchJsonWithFallback<T>(url: string, fallback: T, signal?: AbortSignal): Promise<T> {
  try {
    return await fetchJson<T>(url, signal);
  } catch (err) {
    if (err instanceof NotFoundError) {
      // 404 is expected on first run or when data file doesn't exist yet.
      return fallback;
    }
    // Network errors, 5xx, aborts, etc. — warn so it's not silent.
    console.warn(`[data-loader] Failed to fetch ${url}:`, err);
    throw err;
  }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Load game catalog from games.json.
 */
export async function loadGames(signal?: AbortSignal): Promise<Game[]> {
  try {
    return await fetchJsonWithFallback<Game[]>(`${BASE_DATA_URL}/games.json`, [], signal);
  } catch (err) {
    console.warn('[data-loader] loadGames failed, returning empty list:', err);
    return [];
  }
}

/**
 * Load latest prices from latest.json.
 * Handles both formats:
 * - PriceSnapshot { date, prices } — from crawler
 * - PriceRecord[] — legacy/flat format
 */
export async function loadLatestPrices(signal?: AbortSignal): Promise<PriceRecord[]> {
  try {
    const data = await fetchJsonWithFallback<PriceSnapshot | PriceRecord[]>(
      `${BASE_DATA_URL}/latest.json`,
      [],
      signal,
    );

    // Handle PriceSnapshot format: { date, prices: [...] }
    if (data && typeof data === 'object' && 'prices' in data && Array.isArray(data.prices)) {
      return data.prices;
    }

    // Handle flat PriceRecord[] format
    if (Array.isArray(data)) {
      return data;
    }

    return [];
  } catch (err) {
    console.warn('[data-loader] loadLatestPrices failed, returning empty list:', err);
    return [];
  }
}

/**
 * Load price history for a given month.
 *
 * Handles two formats from the crawler:
 * - PriceDeltaRecord[] — array of daily deltas (each change has `from`/`to` partials)
 * - Record<string, PriceRecord[]> — legacy flat format (full records per date)
 *
 * IMPORTANT: The `to` fields in deltas are `PartialPriceRecord` — they only contain
 * the fields that changed on that date (e.g. just `amount` and `discountPrice`).
 * Consumers must merge these with full snapshots (from `loadLatestPrices`) to get
 * complete records with `currency`, `regularPrice`, `salesStatus`, etc.
 *
 * @returns A record keyed by date (YYYY-MM-DD). Values are partial records from deltas,
 *          or full PriceRecord[] from the legacy format.
 */
export async function loadHistory(
  month: string,
  signal?: AbortSignal,
): Promise<Record<string, PartialPriceRecord[]>> {
  const data = await fetchJsonWithFallback<
    PriceDelta[] | Record<string, PriceRecord[]>
  >(`${BASE_DATA_URL}/history/${month}.json`, {}, signal);

  // Handle PriceDeltaRecord[] format: extract partial records per date
  if (Array.isArray(data)) {
    const result: Record<string, PartialPriceRecord[]> = {};
    for (const delta of data) {
      const partials: PartialPriceRecord[] = delta.changes
        .filter((c): c is { id: string; from: PartialPriceRecord; to: PartialPriceRecord } =>
          c.to != null && typeof c.to === 'object' && 'id' in c.to,
        )
        .map((c) => c.to);
      if (partials.length > 0) {
        result[delta.date] = partials;
      }
    }
    return result;
  }

  // Handle legacy Record<string, PriceRecord[]> format — safe upcast:
  // Full records satisfy PartialPriceRecord (all optional fields present).
  if (data && typeof data === 'object') {
    const result: Record<string, PartialPriceRecord[]> = {};
    for (const [date, records] of Object.entries(data)) {
      result[date] = records;
    }
    return result;
  }

  return {};
}
