/**
 * IGDB (Internet Game Database) Adapter
 *
 * Fetches game cover images from IGDB API using Twitch OAuth.
 * IGDB provides high-quality cover art for Switch games.
 *
 * API Docs: https://api-docs.igdb.com/
 */

import { ofetch } from 'ofetch';

// ─── Types ─────────────────────────────────────────────────

export interface IGDBConfig {
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface IGDBGame {
  id: number;
  name: string;
  cover?: { id: number; url: string };
  platforms?: { id: number; name: string }[];
}

// ─── IGDB Adapter ──────────────────────────────────────────

export class IGDBAdapter {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: IGDBConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Get Twitch OAuth access token (cached until expiry).
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken;
    }

    console.log('[igdb] Requesting new access token...');

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }).toString();

      const response = await ofetch<TwitchTokenResponse>(
        'https://id.twitch.tv/oauth2/token',
        {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.timeoutMs,
        },
      );

      this.accessToken = response.access_token;
      this.tokenExpiresAt = Date.now() + response.expires_in * 1000;

      console.log('[igdb] Access token obtained, expires in', response.expires_in, 'seconds');
      return this.accessToken;
    } catch (err) {
      console.error('[igdb] Failed to get access token:', err);
      throw err;
    }
  }

  /**
   * Make an authenticated request to IGDB API.
   */
  private async igdbRequest<T>(
    endpoint: string,
    body: string,
  ): Promise<T[]> {
    const token = await this.getAccessToken();

    try {
      const response = await ofetch<T[]>(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        timeout: this.timeoutMs,
      });

      return response;
    } catch (err) {
      console.error(`[igdb] Failed to fetch ${endpoint}:`, err);
      throw err;
    }
  }

  /**
   * Extract English search queries from a game title.
   * Handles Chinese titles with English in parentheses or mixed.
   */
  private extractEnglishQueries(title: string): string[] {
    const queries: string[] = [];

    // Strategy 1: Extract English from parenthetical content (e.g. "(Ys Origin)")
    const parenMatch = title.match(/[（(]([^）)]+)[）)]/g);
    if (parenMatch) {
      for (const m of parenMatch) {
        const inner = m.replace(/[（()]/g, '').trim();
        if (/^[A-Za-z0-9\s:'™\-./]+$/.test(inner) && inner.length >= 3) {
          queries.push(inner);
        }
      }
    }

    // Strategy 2: Extract all English words/phrases from the title
    const englishParts = title
      .replace(/[\u4e00-\u9fff]+/g, ' ')
      .replace(/《|》|【|】/g, '')
      .replace(/[^\w\s:'™\-./]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (englishParts.length >= 3) {
      queries.push(englishParts);
      // Also try just the first significant words
      const words = englishParts.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length >= 2) {
        queries.push(words.slice(0, 3).join(' '));
      }
    }

    // Strategy 3: Try the full title as-is
    const cleaned = title
      .replace(/《|》|【|】/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 3 && /[a-zA-Z]/.test(cleaned)) {
      queries.push(cleaned);
    }

    // Deduplicate
    return [...new Set(queries)];
  }

  /**
   * Search for a game by name and return its cover URL.
   * Uses fuzzy search to handle slight name differences.
   */
  async searchGameCover(
    gameName: string,
    platformFilter?: string,
  ): Promise<string | null> {
    try {
      // Extract English queries from the title
      const queries = this.extractEnglishQueries(gameName);
      if (queries.length === 0) {
        console.log(`[igdb] No English text found in "${gameName}"`);
        return null;
      }

      // Try each query
      for (const cleanName of queries) {
        // Search for the game with cover
        let query = `fields name,cover.url,cover.width,cover.height,platforms.name; search "${cleanName}"; limit 5;`;

        // Add platform filter for Switch if specified
        if (platformFilter) {
          query += ` where platforms.name ~ "${platformFilter}";`;
        }

        const games = await this.igdbRequest<IGDBGame>('games', query);

        // Find best match
        for (const game of games) {
          if (game.cover?.url) {
            // IGDB returns //images.igdb.com/... format, prepend https:
            const url = game.cover.url.startsWith('//')
              ? `https:${game.cover.url}`
              : game.cover.url;

            console.log(`[igdb] Found cover for "${game.name}" (${game.id})`);
            return url;
          }
        }

        // If no Switch-specific match, try without platform filter
        if (platformFilter) {
          const allGames = await this.igdbRequest<IGDBGame>(
            'games',
            `fields name,cover.url; search "${cleanName}"; limit 3;`,
          );

          for (const game of allGames) {
            if (game.cover?.url) {
              const url = game.cover.url.startsWith('//')
                ? `https:${game.cover.url}`
                : game.cover.url;
              console.log(`[igdb] Found cover for "${game.name}" (${game.id})`);
              return url;
            }
          }
        }
      }

      return null;
    } catch (err) {
      console.error(`[igdb] Failed to search for "${gameName}":`, err);
      return null;
    }
  }

  /**
   * Batch search for multiple games.
   * Returns a map of game name -> cover URL.
   */
  async batchSearchCovers(
    games: Array<{ id: string; title: string }>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (let i = 0; i < games.length; i++) {
      const game = games[i];

      const coverUrl = await this.searchGameCover(game.title, 'Nintendo Switch');
      if (coverUrl) {
        results.set(game.id, coverUrl);
      }

      if (onProgress) {
        onProgress(i + 1, games.length);
      }

      // Rate limit: IGDB allows ~8 requests/second
      if ((i + 1) % 5 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return results;
  }
}
