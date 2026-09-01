# Crawler Layer Code Review — 2026-08-28

## Summary

The crawler layer is well-structured with clean adapter boundaries and a sensible primary→fallback data flow. The Switch-Games.com adapter (just added) integrates cleanly but has a **critical logic bug** in `salesStatus` and a few robustness gaps around pagination, N+1 queries, and country filtering. The Nintendo API fallback path is solid with proper batching and retry logic. Overall the codebase is production-quality with a few items that need attention before the next release.

---

## Issues

---

### CRITICAL

- **Severity**: Critical
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `toPriceRecord()` always sets `salesStatus: 'onsale'` regardless of actual state. The ternary has identical branches: `salesStatus: raw.on_sale ? 'onsale' : 'onsale'`. This means every price from Switch-Games.com is marked as on-sale, even full-price games — which will generate false-positive delta changes on every run.
- **Suggestion**: Change to:
  ```ts
  salesStatus: raw.on_sale ? 'onsale' : 'onsale',
  // Should be:
  salesStatus: raw.on_sale ? 'onsale' : 'preorder',
  // Or better, map from actual data:
  salesStatus: raw.on_sale
    ? 'onsale'
    : raw.regular_price > 0
      ? 'preorder'  // or a dedicated 'available' status
      : 'not_found',
  ```
  Also verify the PriceRecord type supports the desired status values.

---

- **Severity**: Critical
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `fetchSwitchGames()` in `fetcher.ts` calls `adapter.fetchPrices({ limit: 1000 })` without a `country` filter. The Supabase `prices` table likely contains prices for multiple countries. Without filtering, the snapshot may include non-TW prices, causing incorrect price records and phantom deltas on every run.
- **Suggestion**: Add `country: 'TW'` to the `fetchPrices` call in `fetcher.ts`:
  ```ts
  const rawPrices = await adapter.fetchPrices({ limit: 1000, country: 'TW' });
  ```
  This matches the `country` field from `FetcherConfig`.

---

- **Severity**: Critical
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: No pagination in `fetchSwitchGames()`. The function requests `limit: 500` games and `limit: 1000` prices, but the Supabase API caps at 1000 rows by default. If the catalog exceeds 500 games or the price table exceeds 1000 entries for TW, data will be silently truncated. The comment "limit: 500" suggests awareness but no handling.
- **Suggestion**: Implement pagination or increase limits and add a warning if results hit the limit:
  ```ts
  const rawGames = await adapter.fetchGames({ limit: 1000, country: 'TW' });
  if (rawGames.length >= 1000) {
    console.warn('[fetcher] ⚠️ Switch-Games.com games hit 1000 limit — may be truncated');
  }
  ```
  Or implement proper cursor-based pagination in the adapter.

---

### WARNING

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `getDeals()` method makes an N+1 query pattern — it fetches all on-sale games, then loops through each one calling `fetchPrices({ gameId })` individually. For 50 deals this is 50 sequential HTTP requests. This method isn't used in the main pipeline but is a public API that could be called.
- **Suggestion**: Either batch the game IDs into a single `IN` query, or deprecate this method and document that it's only for small datasets. Consider adding a comment warning about the performance cost.

---

- **Severity**: Warning
- **File**: `crawler/src/services/fetcher.ts`
- **Issue**: `getTodayTaiwanDate()` uses manual `+8 * 60 * 60 * 1000` offset. This works for Taiwan (no DST) but is a fragile pattern. If the timezone logic is ever reused for other regions, it will break silently.
- **Suggestion**: Use `Intl.DateTimeFormat` for correctness:
  ```ts
  function getTodayTaiwanDate(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
  }
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/config.ts`
- **Issue**: `config` is a plain `as const` object derived from `process.env` at module load time. It's not validated — if `CATALOG_URL` is set to an invalid URL, the error only surfaces at runtime deep in the fetch pipeline. There's no startup validation.
- **Suggestion**: Add a `validateConfig()` function called from `index.ts` that checks critical values:
  ```ts
  export function validateConfig(c: typeof config): void {
    if (!c.catalogUrl.startsWith('http')) throw new Error('Invalid CATALOG_URL');
    if (!c.priceApiBaseUrl.startsWith('http')) throw new Error('Invalid PRICE_API_URL');
  }
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `SupabaseGame.id` is used directly as the NSUID in `toGame()`, but the type is `string` with no validation. If the Supabase data uses a different ID format (e.g., UUID, integer), the downstream catalog will have invalid NSUIDs, breaking price lookups and cover URL generation.
- **Suggestion**: Add NSUID format validation in `toGame()`:
  ```ts
  const nsuid = sanitizeNsuid(raw.id); // reuse game-catalog's validator
  if (!nsuid) {
    console.warn(`[switch-games] Skipping game with invalid NSUID: ${raw.id}`);
    // handle gracefully
  }
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `toPriceRecord()` passes potentially `undefined` values to `computeDiscountPercent()` via non-null assertions (`discountPrice!`). While the `hasDiscount` guard should prevent this at runtime, TypeScript's `!` assertions suppress compile-time checks and can mask issues if the guard logic changes.
- **Suggestion**: Use a type narrowing pattern instead:
  ```ts
  const discountPercent = hasDiscount && discountPrice !== undefined
    ? computeDiscountPercent(regularPrice, discountPrice)
    : undefined;
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/adapters/price-api.ts`
- **Issue**: `fetchPriceBatch()` constructs URLs by string concatenation without encoding the `ids` parameter. If any NSUID contains special characters (unlikely but possible with bad upstream data), it could corrupt the query string.
- **Suggestion**: Use `URL` or `URLSearchParams` for query construction:
  ```ts
  const url = new URL(baseUrl);
  url.searchParams.set('country', country);
  url.searchParams.set('lang', lang);
  url.searchParams.set('ids', idsParam);
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: The `restBaseUrl` getter constructs the URL by string interpolation. The Supabase URL might have a trailing slash, causing double-slash (`https://xxx.supabase.co//rest/v1`) which usually works but is unclean.
- **Suggestion**: Normalize the URL:
  ```ts
  private get restBaseUrl() {
    return `${this.config.supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  }
  ```

---

- **Severity**: Warning
- **File**: `crawler/src/index.ts`
- **Issue**: The `SwitchGamesConfig` is conditionally assembled inline. If the env vars are present but malformed (e.g., `SWITCH_GAMES_SUPABASE_URL=not-a-url`), the adapter will be created and fail at HTTP time with a confusing error. No URL format validation is done.
- **Suggestion**: Validate the Supabase URL format when building the config:
  ```ts
  const sgUrl = config.switchGamesSupabaseUrl;
  if (sgUrl && !sgUrl.startsWith('https://')) {
    console.warn('[crawler] SWITCH_GAMES_SUPABASE_URL does not start with https:// — disabling');
  }
  ```

---

### INFO

- **Severity**: Info
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `createSwitchGamesAdapterFromEnv()` factory is defined but never called. The main pipeline manually constructs the adapter in `index.ts`. This is dead code.
- **Suggestion**: Either use it in `index.ts` to simplify config assembly, or remove it to reduce confusion.

---

- **Severity**: Info
- **File**: `crawler/src/services/fetcher.ts`
- **Issue**: `fetchCatalog()` has two parse paths (JSON and HTML) but doesn't log which format it detected. When debugging catalog issues, it's helpful to know which parser ran.
- **Suggestion**: Add a debug log: `console.log(\`[fetcher] Parsing catalog as ${isJsonUrl(url) ? 'JSON' : 'HTML'}\`);`

---

- **Severity**: Info
- **File**: `crawler/src/adapters/game-catalog.ts`
- **Issue**: `parseNintendoCatalogJson()` casts `item` to `NintendoJsonGame` without runtime validation. If the upstream JSON schema changes, this will silently produce bad entries. The `[key: string]: unknown` index signature provides escape hatch but loses type safety.
- **Suggestion**: Add a minimal runtime check:
  ```ts
  if (typeof game.link !== 'string' || typeof game.title !== 'string') continue;
  ```

---

- **Severity**: Info
- **File**: `crawler/src/adapters/price-api.ts`
- **Issue**: `parsePriceEntry()` uses `parseInt()` on `raw_value` without handling NaN. If the API returns a non-numeric `raw_value`, `regularPrice` becomes `NaN`, which propagates silently.
- **Suggestion**: Add NaN guard:
  ```ts
  const regularPrice = entry.regular_price ? parseInt(entry.regular_price.raw_value, 10) : 0;
  if (Number.isNaN(regularPrice) || regularPrice < 0) return { ...defaultRecord, salesStatus: 'not_found' };
  ```

---

- **Severity**: Info
- **File**: `crawler/src/config.ts`
- **Issue**: `openCriticSearchLimit` uses `parseInt` without NaN check. If the env var is set to a non-numeric string, it becomes `NaN`, and `NaN > 0` is `false` — silently disabling OpenCritic searches.
- **Suggestion**: Add fallback: `parseInt(process.env.OPENCRITIC_SEARCH_LIMIT ?? '10', 10) || 10`

---

- **Severity**: Info
- **File**: `crawler/src/adapters/game-catalog.ts`
- **Issue**: `sanitizeTitle()` has ~80 chained `.replace()` calls for HTML entities. This is correct but expensive. Since it runs on every game title, it could be optimized with a single regex or a lookup map, though the current approach is clear and maintainable.
- **Suggestion**: No action needed unless profiling shows this as a bottleneck. Consider adding a comment noting the trade-off.

---

- **Severity**: Info
- **File**: `crawler/src/services/fetcher.ts`
- **Issue**: `fetchSwitchGames()` catches all errors and returns `null`, but `fetchNintendoApi()` (the fallback) lets errors propagate to the top-level `main().catch()`. This asymmetry is intentional but undocumented.
- **Suggestion**: Add a comment explaining the design:
  ```ts
  // Primary source: tolerate failures (return null → fallback).
  // Fallback source: let errors propagate (no further fallback).
  ```

---

- **Severity**: Info
- **File**: `crawler/src/index.ts`
- **Issue**: The `dataDir` default is `'../data'` (relative path). If the crawler's working directory changes, this breaks silently.
- **Suggestion**: Resolve to absolute path:
  ```ts
  dataDir: path.resolve(process.env.DATA_DIR ?? '../data'),
  ```

---

## TypeScript Compilation

Production source files compile cleanly with `--noEmit`. Two minor issues in non-production code:

- `persister.ts`: `PriceDelta` is imported but never used (dead import)
- `persister.test.ts`: References `appendDelta` and `readDeltas` which no longer exist in `persister.ts` — stale test after refactor

---

## Positive Observations

1. **Clean adapter pattern**: The primary→fallback flow in `fetcher.ts` is elegant — `fetchSwitchGames` returns `null` on failure, `runFetch` handles the fallback decision. Well-separated concerns.

2. **Atomic writes in persister**: The `atomicWrite()` function with backup/restore is a robust pattern for data integrity. Good defensive programming.

3. **Rate limiting and batching**: The Nintendo API adapter's `chunkArray` + sleep pattern is well-tuned. The 50-item batch size and 200ms inter-batch delay are reasonable defaults.

4. **Type narrowing in price parsing**: `parsePriceEntry()` in `price-api.ts` correctly handles nullable fields from the Nintendo API with proper null checks before numeric operations.

5. **Merge strategy in `writeGames()`**: The field-level merge (prefer existing `coverUrl`/`platform`/`releaseDate` when new value is empty) is a smart approach for data from multiple sources.

---

## Verdict: OK

The critical issues (salesStatus bug, missing country filter, no pagination) should be fixed before next deployment, but the overall architecture is sound. The fallback chain is well-designed, the adapter boundaries are clean, and the codebase shows good defensive programming patterns throughout.
