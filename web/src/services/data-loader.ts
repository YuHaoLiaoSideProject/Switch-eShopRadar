import type { Game, PriceRecord } from '@/types';

const BASE_DATA_URL = './data';

/**
 * Load the full game list from games.json.
 */
export async function loadGames(): Promise<Game[]> {
  const response = await fetch(`${BASE_DATA_URL}/games.json`);
  if (!response.ok) {
    throw new Error(`Failed to load games: ${response.status}`);
  }
  return response.json();
}

/**
 * Load current prices from latest.json.
 */
export async function loadLatestPrices(): Promise<PriceRecord[]> {
  const response = await fetch(`${BASE_DATA_URL}/latest.json`);
  if (!response.ok) {
    throw new Error(`Failed to load latest prices: ${response.status}`);
  }
  return response.json();
}

/**
 * Load price history for a given month (YYYY-MM format).
 */
export async function loadHistory(month: string): Promise<Record<string, PriceRecord[]>> {
  const response = await fetch(`${BASE_DATA_URL}/history/${month}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load history for ${month}: ${response.status}`);
  }
  return response.json();
}
