import { ofetch } from 'ofetch';

// ─── Types ──────────────────────────────────────────────────

export interface OpenCriticGame {
  id: number;
  name: string;
  topCriticScore: number | null;
  tier: string;
  Platforms: Array<{
    id: number;
    name: string;
    shortName: string;
  }>;
  images: {
    box?: { og: string; sm: string };
    masthead?: { og: string };
  };
}

export interface OpenCriticSearchResult {
  id: number;
  name: string;
  dist: number; // trigram distance (0 = perfect match)
}

// ─── Configuration ──────────────────────────────────────────

const BASE_URL = 'https://opencritic-api.p.rapidapi.com';
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_DELAY_MS = 300; // Stay under 4 req/sec limit

// ─── Sleep helper ───────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Adapter ────────────────────────────────────────────────

export class OpenCriticAdapter {
  private readonly headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'opencritic-api.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    };
  }

  /**
   * Get top games sorted by score.
   * Only 1 API call needed, returns ~20 games.
   */
  async getTopGames(): Promise<OpenCriticGame[]> {
    try {
      const games = await this.request<OpenCriticGame[]>(
        '/game?sort=topScore&order=desc&tier=Mighty,Great,Good',
      );
      return games ?? [];
    } catch (err) {
      console.warn('[opencritic] Failed to fetch top games:', err);
      return [];
    }
  }

  /**
   * Match OpenCritic top games with our catalog by title similarity.
   * Only 1 API call needed.
   */
  async matchGamesWithScores(
    ourGames: Array<{ id: string; title: string }>,
  ): Promise<Map<string, { openCriticId: number; score: number | null; tier: string }>> {
    const results = new Map<string, { openCriticId: number; score: number | null; tier: string }>();

    // Get top games from OpenCritic (1 API call)
    const topGames = await this.getTopGames();

    if (!topGames || topGames.length === 0) {
      console.warn('[opencritic] No top games returned');
      return results;
    }

    console.log(`[opencritic] Got ${topGames.length} top games from OpenCritic`);

    // Build a normalized name lookup
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const ocGame of topGames) {
      const ocNameNormalized = normalize(ocGame.name);

      // Find matching game in our catalog
      for (const ourGame of ourGames) {
        const ourNameNormalized = normalize(ourGame.title);

        // --- matching logic ---
        // 1. Exact match always qualifies.
        // 2. Substring (includes) only when BOTH names are long enough
        //    AND the longer name is not more than 2× the shorter name.
        //    This prevents short strings like "zelda" matching
        //    unrelated titles like "superzeldabreath".
        const isExact = ocNameNormalized === ourNameNormalized;
        const shorterLen = Math.min(ocNameNormalized.length, ourNameNormalized.length);
        const longerLen = Math.max(ocNameNormalized.length, ourNameNormalized.length);
        const MIN_SUBSTR_LEN = 5;
        const MAX_LENGTH_RATIO = 2;
        const isSubstring =
          shorterLen >= MIN_SUBSTR_LEN &&
          longerLen <= shorterLen * MAX_LENGTH_RATIO &&
          (ocNameNormalized.includes(ourNameNormalized) ||
            ourNameNormalized.includes(ocNameNormalized));

        if (isExact || isSubstring) {
          // Skip if already has score
          if (results.has(ourGame.id)) continue;

          results.set(ourGame.id, {
            openCriticId: ocGame.id,
            score: ocGame.topCriticScore,
            tier: ocGame.tier,
          });
          console.log(`[opencritic] Matched: "${ourGame.title}" -> "${ocGame.name}" (${ocGame.topCriticScore})`);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Search for a game by name (uses 1 search quota).
   */
  async searchGame(name: string): Promise<OpenCriticSearchResult | null> {
    try {
      const results = await this.request<OpenCriticSearchResult[]>(
        `/game/search?criteria=${encodeURIComponent(name)}`,
      );

      if (!results || results.length === 0) return null;

      // Return the best match (lowest distance = closest match)
      return results.reduce((best, curr) =>
        curr.dist < best.dist ? curr : best,
      );
    } catch (err) {
      console.warn(`[opencritic] Search failed for "${name}":`, err);
      return null;
    }
  }

  /**
   * Get full game details including score (uses 1 request).
   */
  async getGame(id: number): Promise<OpenCriticGame | null> {
    try {
      return await this.request<OpenCriticGame>(`/game/${id}`);
    } catch (err) {
      console.warn(`[opencritic] Get game ${id} failed:`, err);
      return null;
    }
  }

  /**
   * Find game by name and return its score (uses 2 requests: search + get).
   */
  async findGameScore(name: string): Promise<{
    openCriticId: number;
    score: number | null;
    tier: string;
  } | null> {
    const searchResult = await this.searchGame(name);
    if (!searchResult) return null;

    // Skip low-quality matches (distance > 0.5 means poor match)
    if (searchResult.dist > 0.5) return null;

    await sleep(REQUEST_DELAY_MS);

    const game = await this.getGame(searchResult.id);
    if (!game) return null;

    return {
      openCriticId: game.id,
      score: game.topCriticScore,
      tier: game.tier,
    };
  }

  /**
   * Batch fetch scores for multiple games using search.
   * Each game uses 2 requests (search + get).
   * Only use this for games not found via matchGamesWithScores.
   */
  async findScoresForGames(
    games: Array<{ id: string; title: string }>,
    limit = 25,
  ): Promise<Map<string, { openCriticId: number; score: number | null; tier: string }>> {
    const results = new Map<string, { openCriticId: number; score: number | null; tier: string }>();
    const gamesToSearch = games.slice(0, limit);

    for (const game of gamesToSearch) {
      const scoreData = await this.findGameScore(game.title);
      if (scoreData) {
        results.set(game.id, scoreData);
      }
      // Rate limit between requests
      await sleep(REQUEST_DELAY_MS);
    }

    return results;
  }

  // ─── HTTP Client ────────────────────────────────────────────

  private async request<T>(path: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        return await ofetch<T>(`${BASE_URL}${path}`, {
          headers: this.headers,
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on 4xx (except 429)
        const status = (err as Record<string, unknown>)?.status as number | undefined;
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw lastError;
        }

        if (attempt < RETRY_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError ?? new Error('OpenCritic request failed');
  }
}
