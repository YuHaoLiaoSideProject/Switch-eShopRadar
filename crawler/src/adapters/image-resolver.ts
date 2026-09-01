/**
 * Image Resolver
 *
 * Fetches game cover images from multiple sources with fallback:
 * 1. IGDB API (high-quality cover art)
 * 2. Nintendo.com product page → assets.nintendo.com CDN (best quality)
 * 3. Wikipedia API (fallback)
 * 4. Empty string (last resort)
 *
 * Results are cached to avoid re-fetching.
 */

import { ofetch } from 'ofetch';
import * as fs from 'fs';
import * as path from 'path';
import { IGDBAdapter } from './igdb';

// ─── Types ─────────────────────────────────────────────────

export interface ImageResolverConfig {
  /** Directory to store cache file */
  dataDir: string;
  /** Directory for crawler cache files (optional, defaults to dataDir) */
  cacheDir?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Delay between requests in ms (rate limiting) */
  requestDelayMs?: number;
  /** IGDB Client ID (optional, enables IGDB source) */
  igdbClientId?: string;
  /** IGDB Client Secret (optional, enables IGDB source) */
  igdbClientSecret?: string;
}

interface CacheEntry {
  url: string;
  source: 'igdb' | 'nintendo' | 'wikipedia';
  updatedAt: string;
}

type CacheMap = Record<string, CacheEntry>;

// ─── Nintendo.com Page Scraper ─────────────────────────────

/**
 * Seed URLs: popular game pages that contain many related game hashes.
 * Each page exposes dozens of related games' image hashes.
 */
const SEED_URLS = [
  'https://www.nintendo.com/us/store/products/the-legend-of-zelda-breath-of-the-wild-switch/',
  'https://www.nintendo.com/us/store/products/super-mario-odyssey-switch/',
  'https://www.nintendo.com/us/store/products/mario-kart-8-deluxe-switch/',
  'https://www.nintendo.com/us/store/products/super-smash-bros-ultimate-switch/',
  'https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/',
  'https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/',
  'https://www.nintendo.com/us/store/products/pokemon-scarlet-switch/',
  'https://www.nintendo.com/us/store/products/pokemon-violet-switch/',
  'https://www.nintendo.com/us/store/products/splatoon-3-switch/',
  'https://www.nintendo.com/us/store/products/fire-emblem-engage-switch/',
  'https://www.nintendo.com/us/store/products/xenoblade-chronicles-3-switch/',
  'https://www.nintendo.com/us/store/products/metroid-dread-switch/',
  'https://www.nintendo.com/us/store/products/pikmin-4-switch/',
  'https://www.nintendo.com/us/store/products/little-nightmares-ii-switch/',
  'https://www.nintendo.com/us/store/products/hollow-knight-switch/',
  'https://www.nintendo.com/us/store/products/stardew-valley-switch/',
  'https://www.nintendo.com/us/store/products/minecraft-switch/',
  'https://www.nintendo.com/us/store/products/cuphead-switch/',
  'https://www.nintendo.com/us/store/products/celeste-switch/',
  'https://www.nintendo.com/us/store/products/hades-switch/',
];

/**
 * Build a hash map from Nintendo.com by scraping seed pages.
 * Extracts ALL nsuid/hash pairs AND title/nsuid mapping from __NEXT_DATA__.
 */
async function buildNintendoHashMap(
  timeoutMs: number,
  requestDelayMs: number,
): Promise<{ hashes: Map<string, string>; titleToHash: Map<string, string> }> {
  const nsuidToHash = new Map<string, string>();
  const titleToHash = new Map<string, string>();

  for (let i = 0; i < SEED_URLS.length; i++) {
    const url = SEED_URLS[i];
    console.log(`[image-resolver] Scraping page ${i + 1}/${SEED_URLS.length}...`);
    try {
      const html = await ofetch(url, {
        responseType: 'text',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }) as string;

      // Extract all nsuid/hash pairs
      const hashRegex = /store\/software\/switch\/(\d+)\/([a-f0-9]{64})/g;
      let match;
      while ((match = hashRegex.exec(html)) !== null) {
        const [, nsuid, hash] = match;
        if (!nsuidToHash.has(nsuid)) {
          nsuidToHash.set(nsuid, hash);
        }
      }

      // Extract title → nsuid mapping from __NEXT_DATA__
      const nextDataMatch = html.match(/__NEXT_DATA__[^>]*>(.*?)<\/script>/s);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const apollo = nextData?.props?.pageProps?.initialApolloState || {};
          for (const val of Object.values(apollo)) {
            if (val && typeof val === 'object' && 'nsuid' in val && 'name' in val) {
              const p = val as { nsuid: string; name: string };
              if (p.nsuid && p.name) {
                const hash = nsuidToHash.get(p.nsuid);
                if (hash) {
                  titleToHash.set(p.name.toLowerCase(), hash);
                }
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch (err) {
      console.error(`[image-resolver] Failed to scrape ${url}:`, err);
    }
    console.log(`[image-resolver]   Hashes: ${nsuidToHash.size}, Title mappings: ${titleToHash.size}`);
    if (i < SEED_URLS.length - 1) {
      await new Promise((r) => setTimeout(r, requestDelayMs));
    }
  }

  return { hashes: nsuidToHash, titleToHash };
}

// ─── Wikipedia API ─────────────────────────────────────────

/**
 * Search Wikipedia for a game and return its image URL.
 */
async function searchWikipedia(
  query: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`;

    const searchData = await ofetch<{ query?: { search?: Array<{ title: string; pageid: number }> } }>(
      searchUrl,
      {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Switch-eShopRadar/1.0' },
      },
    );

    const firstResult = searchData?.query?.search?.[0];
    if (!firstResult) return null;

    // Get the page image
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`;
    const summary = await ofetch<{ thumbnail?: { source: string } }>(summaryUrl, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Switch-eShopRadar/1.0' },
    });
    return summary?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract English keywords from a game title for Wikipedia search.
 * Tries multiple strategies to find searchable English text.
 */
function extractSearchQueries(title: string): string[] {
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
    // Try the full English portion
    queries.push(englishParts);
    // Also try just the first significant words
    const words = englishParts.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length >= 2) {
      queries.push(words.slice(0, 3).join(' '));
    }
  }

  // Strategy 3: Try the full title as-is (Wikipedia handles some Chinese)
  const cleaned = title
    .replace(/《|》|【|】/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3) {
    queries.push(cleaned);
  }

  // Deduplicate
  return [...new Set(queries)];
}

async function fetchWikipediaImage(
  title: string,
  timeoutMs: number,
): Promise<string | null> {
  const queries = extractSearchQueries(title);

  for (const query of queries) {
    const image = await searchWikipedia(query, timeoutMs);
    if (image) return image;
  }

  return null;
}

// ─── Main Resolver ─────────────────────────────────────────

export class ImageResolver {
  private readonly cacheDir: string;
  private readonly timeoutMs: number;
  private readonly requestDelayMs: number;
  private cache: CacheMap = {};
  private cachePath: string;
  private nintendoHashMap: Map<string, string> | null = null;
  private nintendoTitleMap: Map<string, string> | null = null;
  private igdbAdapter: IGDBAdapter | null = null;

  constructor(config: ImageResolverConfig) {
    this.cacheDir = config.cacheDir ?? config.dataDir;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.requestDelayMs = config.requestDelayMs ?? 500;
    this.cachePath = path.join(this.cacheDir, 'image-cache.json');
    this.loadCache();

    // Initialize IGDB adapter if credentials provided
    if (config.igdbClientId && config.igdbClientSecret) {
      this.igdbAdapter = new IGDBAdapter({
        clientId: config.igdbClientId,
        clientSecret: config.igdbClientSecret,
        timeoutMs: this.timeoutMs,
      });
      console.log('[image-resolver] IGDB adapter enabled');
    }
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        this.cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      }
    } catch {
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[image-resolver] Failed to save cache:', err);
    }
  }

  private async delay(): Promise<void> {
    if (this.requestDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
    }
  }

  /**
   * Build the Nintendo hash map by scraping seed pages.
   * Cached in memory for the lifetime of the resolver.
   */
  private async getNintendoHashMap(): Promise<{ hashes: Map<string, string>; titleMap: Map<string, string> }> {
    if (this.nintendoHashMap && this.nintendoTitleMap) return { hashes: this.nintendoHashMap, titleMap: this.nintendoTitleMap };

    // Check if we can load from local files
    const hashMapPath = path.join(this.cacheDir, 'nintendo-hash-map.json');
    const titleMapPath = path.join(this.cacheDir, 'nintendo-title-map.json');
    try {
      if (fs.existsSync(hashMapPath) && fs.existsSync(titleMapPath)) {
        const hashData = JSON.parse(fs.readFileSync(hashMapPath, 'utf-8'));
        const titleData = JSON.parse(fs.readFileSync(titleMapPath, 'utf-8'));
        this.nintendoHashMap = new Map(Object.entries(hashData));
        this.nintendoTitleMap = new Map(Object.entries(titleData));
        console.log(`[image-resolver] Loaded ${this.nintendoHashMap.size} hashes, ${this.nintendoTitleMap.size} title mappings from cache`);
        return { hashes: this.nintendoHashMap, titleMap: this.nintendoTitleMap };
      }
    } catch {
      // ignore
    }

    console.log('[image-resolver] Building Nintendo hash map from seed pages...');
    const result = await buildNintendoHashMap(this.timeoutMs, this.requestDelayMs);
    this.nintendoHashMap = result.hashes;
    this.nintendoTitleMap = result.titleToHash;

    // Save to files for next time
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      fs.writeFileSync(hashMapPath, JSON.stringify(Object.fromEntries(this.nintendoHashMap)), 'utf-8');
      fs.writeFileSync(titleMapPath, JSON.stringify(Object.fromEntries(this.nintendoTitleMap)), 'utf-8');
      console.log(`[image-resolver] Saved ${this.nintendoHashMap.size} hashes, ${this.nintendoTitleMap.size} title mappings`);
    } catch {
      // ignore
    }

    return { hashes: this.nintendoHashMap, titleMap: this.nintendoTitleMap };
  }

  /**
   * Resolve image URL for a game. Returns cached result if available.
   */
  async resolve(
    nsuid: string,
    title: string,
    _currentCoverUrl?: string,
  ): Promise<{ url: string; source: string }> {
    // Check cache first
    if (this.cache[nsuid]) {
      return { url: this.cache[nsuid].url, source: this.cache[nsuid].source };
    }

    // 1. Try IGDB first (if adapter available)
    if (this.igdbAdapter) {
      await this.delay();
      const igdbUrl = await this.igdbAdapter.searchGameCover(title, 'Nintendo Switch');
      if (igdbUrl) {
        const entry: CacheEntry = {
          url: igdbUrl,
          source: 'igdb',
          updatedAt: new Date().toISOString(),
        };
        this.cache[nsuid] = entry;
        this.saveCache();
        return { url: igdbUrl, source: 'igdb' };
      }
    }

    // 2. Try Nintendo hash map
    const { hashes, titleMap } = await this.getNintendoHashMap();
    
    // Try matching by US NSUID first
    if (hashes.has(nsuid)) {
      const hash = hashes.get(nsuid)!;
      const url = `https://assets.nintendo.com/image/upload/c_fill,w_600/q_auto:best/f_auto/store/software/switch/${nsuid}/${hash}`;
      const entry: CacheEntry = { url, source: 'nintendo', updatedAt: new Date().toISOString() };
      this.cache[nsuid] = entry;
      this.saveCache();
      return { url, source: 'nintendo' };
    }

    // Try matching by title (only from parenthetical English to avoid false positives)
    // Extract English from parentheses first (highest confidence)
    const parenMatches = title.match(/[（(]([^）)]+)[）)]/g);
    if (parenMatches) {
      for (const m of parenMatches) {
        const english = m.replace(/[（()]/g, '').trim().toLowerCase();
        if (english.length < 3 || !/[a-z]/.test(english)) continue;
        for (const [usTitle, hash] of titleMap) {
          if (usTitle === english || usTitle.startsWith(english) || english.startsWith(usTitle)) {
            const url = `https://assets.nintendo.com/image/upload/c_fill,w_600/q_auto:best/f_auto/store/software/switch/${nsuid}/${hash}`;
            const entry: CacheEntry = { url, source: 'nintendo', updatedAt: new Date().toISOString() };
            this.cache[nsuid] = entry;
            this.saveCache();
            return { url, source: 'nintendo' };
          }
        }
      }
    }

    // Extract standalone English words from title
    const englishParts = title
      .replace(/[\u4e00-\u9fff]+/g, ' ')
      .replace(/《|》|【|】/g, '')
      .replace(/[^\w\s:'™\-./]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (englishParts.length >= 3) {
      for (const [usTitle, hash] of titleMap) {
        if (usTitle === englishParts || englishParts === usTitle) {
          const url = `https://assets.nintendo.com/image/upload/c_fill,w_600/q_auto:best/f_auto/store/software/switch/${nsuid}/${hash}`;
          const entry: CacheEntry = { url, source: 'nintendo', updatedAt: new Date().toISOString() };
          this.cache[nsuid] = entry;
          this.saveCache();
          return { url, source: 'nintendo' };
        }
      }
    }

    // 3. Fallback: Try Wikipedia
    await this.delay();
    const wikiImage = await fetchWikipediaImage(title, this.timeoutMs);
    if (wikiImage) {
      const entry: CacheEntry = {
        url: wikiImage,
        source: 'wikipedia',
        updatedAt: new Date().toISOString(),
      };
      this.cache[nsuid] = entry;
      this.saveCache();
      return { url: wikiImage, source: 'wikipedia' };
    }

    // Return empty if nothing found
    return { url: '', source: 'none' };
  }

  /**
   * Resolve images for multiple games in batch.
   */
  async resolveBatch(
    games: Array<{ nsuid: string; title: string; coverUrl?: string }>,
    onProgress?: (current: number, total: number) => void,
  ): Promise<Map<string, { url: string; source: string }>> {
    const results = new Map<string, { url: string; source: string }>();
    let fetched = 0;

    for (let i = 0; i < games.length; i++) {
      const game = games[i];

      // Check cache first
      if (this.cache[game.nsuid]) {
        results.set(game.nsuid, {
          url: this.cache[game.nsuid].url,
          source: this.cache[game.nsuid].source,
        });
        continue;
      }

      // Resolve image
      const result = await this.resolve(game.nsuid, game.title, game.coverUrl);
      results.set(game.nsuid, result);
      fetched++;

      if (onProgress) {
        onProgress(i + 1, games.length);
      }

      // Rate limit
      if (fetched % 20 === 0) {
        this.saveCache();
      }
    }

    this.saveCache();
    return results;
  }

  /**
   * Get cache stats.
   */
  getStats(): { cached: number; path: string } {
    return {
      cached: Object.keys(this.cache).length,
      path: this.cachePath,
    };
  }
}
