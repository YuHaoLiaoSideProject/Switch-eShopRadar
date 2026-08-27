import type { Game, PriceRecord } from '@/types';

const BASE_DATA_URL = './data';
const TIMEOUT_MS = 10_000;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: signal ?? controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function loadGames(signal?: AbortSignal): Promise<Game[]> {
  return fetchJson<Game[]>(`${BASE_DATA_URL}/games.json`, signal);
}

export function loadLatestPrices(signal?: AbortSignal): Promise<PriceRecord[]> {
  return fetchJson<PriceRecord[]>(`${BASE_DATA_URL}/latest.json`, signal);
}

export function loadHistory(
  month: string,
  signal?: AbortSignal,
): Promise<Record<string, PriceRecord[]>> {
  return fetchJson<Record<string, PriceRecord[]>>(`${BASE_DATA_URL}/history/${month}.json`, signal);
}
