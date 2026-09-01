// ─── Centralized API & Runtime Configuration ──────────────
//
// All external URLs and tunables live here.
// Overridable via environment variables; sensible defaults for TW.

export const config = {
  // ─── Primary Source: Switch-Games.com ───────────────────────
  /** Switch-Games.com Supabase URL (primary data source) */
  switchGamesSupabaseUrl: process.env.SWITCH_GAMES_SUPABASE_URL ?? '',
  /** Switch-Games.com Supabase anon key */
  switchGamesAnonKey: process.env.SWITCH_GAMES_ANON_KEY ?? '',

  // ─── Fallback Source: Nintendo Official API ────────────────
  /** Nintendo HK/TW game catalog (JSON or HTML) — fallback */
  catalogUrl:
    process.env.CATALOG_URL ??
    'https://www.nintendo.com/tw/data/json/switch_software.json',
  /** Nintendo eShop Price API (batch price lookup) — fallback */
  priceApiBaseUrl:
    process.env.PRICE_API_URL ??
    'https://api.ec.nintendo.com/v1/price',
  /** Nintendo store cover image CDN prefix */
  coverCdn:
    process.env.COVER_CDN ??
    'https://store.nintendo.com.hk/media/catalog/product',

  // ─── IGDB (Internet Game Database) ───────────────────────
  /** IGDB Client ID (Twitch app) */
  igdbClientId: process.env.IGDB_CLIENT_ID ?? '',
  /** IGDB Client Secret (for obtaining access token) */
  igdbClientSecret: process.env.IGDB_CLIENT_SECRET ?? '',

  // ─── OpenCritic ────────────────────────────────────────────
  /** OpenCritic via RapidAPI */
  openCriticBaseUrl:
    process.env.OPENCRITIC_BASE_URL ??
    'https://opencritic-api.p.rapidapi.com',
  /** RapidAPI key for OpenCritic (empty string = skip) */
  openCriticApiKey: process.env.OPENCRITIC_API_KEY ?? '',
  /** Max OpenCritic search calls per run */
  openCriticSearchLimit: parseInt(
    process.env.OPENCRITIC_SEARCH_LIMIT ?? '10',
    10,
  ) || 10,

  /** Nintendo eShop country code */
  country: process.env.COUNTRY ?? 'TW',

  /** UI language for price API responses */
  lang: process.env.ESHOP_LANG ?? 'zh',

  /** Local data output directory */
  dataDir: process.env.DATA_DIR ?? '../data',
  /** Cache directory for crawler temporary files */
  cacheDir: process.env.CACHE_DIR ?? '../.cache',
} as const;

/** Validate config values at startup. Returns a list of warnings (empty = OK). */
export function validateConfig(): string[] {
  const warnings: string[] = [];

  if (!config.catalogUrl.startsWith('http')) {
    warnings.push(`catalogUrl does not start with http: "${config.catalogUrl}"`);
  }
  if (!config.priceApiBaseUrl.startsWith('http')) {
    warnings.push(`priceApiBaseUrl does not start with http: "${config.priceApiBaseUrl}"`);
  }
  if (config.switchGamesSupabaseUrl && !config.switchGamesSupabaseUrl.startsWith('https://')) {
    warnings.push(`switchGamesSupabaseUrl does not start with https://: "${config.switchGamesSupabaseUrl}"`);
  }
  if (Number.isNaN(config.openCriticSearchLimit)) {
    warnings.push(`openCriticSearchLimit is NaN — falling back to 10`);
  }

  return warnings;
}
