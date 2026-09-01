# Code Review — Shared Layer & Test Coverage

**Date:** 2026-08-28
**Reviewer:** Agent (read-only review)
**Scope:** `packages/shared`, `crawler/src/adapters/__tests__/`, `crawler/src/services/__tests__/`, `web/src/__tests__/`, `vitest.workspace.ts`

---

## Issues

### 1. `appendDelta` and `readDeltas` are imported in tests but do not exist in source

- **Severity**: Critical
- **File**: `crawler/src/services/__tests__/persister.test.ts` (lines 3, 173–233), `crawler/src/services/persister.ts`
- **Issue**: The test file imports `appendDelta` and `readDeltas` from `../persister`, but `persister.ts` exports no such functions. The source has `writeLatest`, `readLatest`, `writeDailySnapshot`, `readDailySnapshot` — but no delta-level persistence helpers. This causes **8 test failures** (all `TypeError: (0 , appendDelta) is not a function`).
- **Suggestion**: Either (a) implement `appendDelta(date, dataDir)` and `readDeltas(month, dataDir)` in `persister.ts` to match the intended `history/YYYY-MM.json` append-only JSON array design visible in the test expectations, or (b) rewrite the tests to use existing `writeDailySnapshot`/`readDailySnapshot` if the history-per-month format is no longer the intended approach. The test expectations (append JSON array, idempotent by date, handle corruption) are well-designed — implement the missing functions.

### 2. `computeDiscountPercent` edge case: negative discount (price increase)

- **Severity**: Warning
- **File**: `packages/shared/src/index.ts`
- **Issue**: `computeDiscountPercent` returns a positive value when `discountPrice > regularPrice` (e.g. regular=1500, discount=2000 → `-33` rounds to `-33`). The function currently returns negative values for price increases, which downstream code may not expect (e.g. `discountPercent?: number` in `PriceRecord`).
- **Suggestion**: Guard against `discountPrice >= regularPrice` — return `0` or `undefined` when there's no real discount. Alternatively, document the negative-value semantics. The `price-api.ts` adapter already guards with `discountRaw < regularPrice`, but `switch-games.ts` does not.

### 3. `switch-games.ts` `toPriceRecord` — hardcoded `salesStatus: 'onsale'`

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts` (line ~155)
- **Issue**: The `toPriceRecord` method maps `raw.on_sale` to `'onsale'` in both branches: `salesStatus: raw.on_sale ? 'onsale' : 'onsale'` — this is a dead ternary. Games that are not on sale (e.g. preorder, unreleased) will all be marked `'onsale'`.
- **Suggestion**: Map `on_sale: false` to a more appropriate default (e.g. `'onsale'` for available games, or introduce a status heuristic based on `release_date` vs today). At minimum, remove the no-op ternary.

### 4. `Game.rating` is optional — no validation of range

- **Severity**: Info
- **File**: `packages/shared/src/index.ts`
- **Issue**: `rating?: number` documents "Metacritic score 0-100" but nothing enforces the range. Values outside 0–100 would be silently accepted.
- **Suggestion**: Consider adding a branded type or a runtime validator (e.g. `clampRating(n: number): number`) in the shared utilities. Low priority since scores come from OpenCritic which already validates.

### 5. `GameCatalog` type is defined but never used

- **Severity**: Info
- **File**: `packages/shared/src/index.ts`
- **Issue**: `GameCatalog` interface is exported but grep shows zero imports across crawler and web. The `writeGames`/`readGames` functions in `persister.ts` work with `Game[]` directly, not `GameCatalog`.
- **Suggestion**: Either use `GameCatalog` as the serialized format (wrapping `updatedAt` + `games[]`) or remove it to reduce dead API surface.

### 6. `PriceDelta.changes` uses `Partial<PriceRecord>` for `from`/`to` — lossy for removals

- **Severity**: Info
- **File**: `packages/shared/src/index.ts`, `crawler/src/services/delta.ts`
- **Issue**: When a game is removed from the new snapshot, `computeDelta` silently skips it (comment: "Could track removals if needed; for now skip"). The `PriceDelta` type has no field to express removals.
- **Suggestion**: If removals matter (e.g. for notifications), extend `PriceDelta` with a `removed?: string[]` field.

### 7. Web types re-export is a thin passthrough — good, but no `PriceSnapshot`/`PriceDelta` re-export

- **Severity**: Info
- **File**: `web/src/types/index.ts`
- **Issue**: Web re-exports `Game` and `PriceRecord` from `@eshop/shared` but not `PriceSnapshot` or `PriceDelta`. The `data-loader.ts` service likely needs these.
- **Suggestion**: If `data-loader` imports directly from `@eshop/shared`, the re-exports are just convenience. Consider re-exporting all shared types for consistency, or document the intent.

### 8. `switch-games.ts` `toPriceRecord` — missing `id` mapping for some edge cases

- **Severity**: Warning
- **File**: `crawler/src/adapters/switch-games.ts`
- **Issue**: `id: raw.game_id ?? raw.id` — if both are `undefined`, the record gets `id: undefined` which violates the `PriceRecord.id: string` contract. The `SupabasePrice` type has `id` as required but `game_id` is also required in practice, so this is unlikely but the fallback chain could produce `undefined`.
- **Suggestion**: Add a guard: `id: raw.game_id || raw.id || throw new Error('Price record missing id')`.

### 9. `opencritic.test.ts` — `matchGamesWithScores` uses `toEqual` on Set, which doesn't work

- **Severity**: Warning
- **File**: `crawler/src/adapters/__tests__/opencritic.test.ts` (line ~55)
- **Issue**: `expect(result.size).toBe(2)` is correct, but the test doesn't verify *which* games matched. More importantly, `toEqual` is never called on the Set directly (the test avoids this), but the assertion is shallow — it doesn't verify the Map values (scores).
- **Suggestion**: Add assertions on `result.get('game-1')` and `result.get('game-2')` to verify the score values were correctly extracted.

### 10. `persister.test.ts` — `makeTmpDir` creates dirs that aren't cleaned up on failure

- **Severity**: Info
- **File**: `crawler/src/services/__tests__/persister.test.ts`
- **Issue**: `afterEach` calls `fs.rmSync(tmpDir, ...)`, but if the test throws before `tmpDir` is assigned (impossible here since `beforeEach` runs first) or if `rmSync` itself fails, temp dirs accumulate. The pattern is fine for CI but can leak on developer machines.
- **Suggestion**: Use `vitest`'s `vi.tmpdir()` or `os.tmpdir()` with a unique suffix + try/finally, or accept this as acceptable for test code.

### 11. `delta.test.ts` — `makeRecord` defaults `amount` to 179000 (cent notation) but test data is inconsistent

- **Severity**: Info
- **File**: `crawler/src/services/__tests__/delta.test.ts`
- **Issue**: `makeRecord` defaults `amount: 179000` (looks like cent notation), but `switch-games.test.ts` uses `regular_price: 1790` (TWD integer) and `price-api.test.ts` uses `raw_value: '1790'`. The shared `PriceRecord` doesn't document whether amounts are in TWD integers (1790 = NT$1790) or sub-units. The `amount` comment in shared says "TWD raw_value, 如 1790 = NT$1790", but `delta.test.ts` uses 179000.
- **Suggestion**: Align all test fixtures to the documented convention (1790, not 179000). Update `makeRecord` default to `1790`. This is a test-only inconsistency but signals confusion about the data format.

### 12. No test for `persister.ts` functions: `writeGames`, `readGames`, `updateGameScores`, `writeDailySnapshot`, `readDailySnapshot`, `getLatestSnapshotDate`

- **Severity**: Warning
- **File**: `crawler/src/services/persister.ts`
- **Issue**: Only `writeLatest` and `readLatest` have passing tests. Six exported functions have zero test coverage: `writeGames`, `readGames`, `updateGameScores`, `writeDailySnapshot`, `readDailySnapshot`, `getLatestSnapshotDate`.
- **Suggestion**: Add tests for these functions, especially `writeGames` (merge logic), `updateGameScores` (score update idempotency), and `writeDailySnapshot` (date-keyed file naming).

### 13. No test for `packages/shared` utility function behavior

- **Severity**: Warning
- **File**: `packages/shared/src/__tests__/shared.test.ts`
- **Issue**: The shared test file only tests types (`expectTypeOf`) and literal construction. `computeDiscountPercent` is never tested directly — it's only exercised indirectly through adapter tests. No test for `regularPrice === 0` → returns `0` edge case.
- **Suggestion**: Add unit tests for `computeDiscountPercent` covering: normal discount, zero regular price, equal prices (0%), discount > regular (negative), rounding behavior.

### 14. `vitest.workspace.ts` — no coverage config at workspace level

- **Severity**: Info
- **File**: `vitest.workspace.ts`
- **Issue**: The workspace config only defines project globs. Coverage is configured per-project (e.g. `crawler/vitest.config.ts` has `coverage.provider: 'v8'`). No global coverage thresholds are enforced.
- **Suggestion**: Consider adding `coverage thresholds` in the workspace config to enforce minimum coverage (e.g. 80% lines) across all projects.

### 15. `price-api.ts` `parsePriceEntry` — `sales_status` fallback to `'not_found'` may mask real statuses

- **Severity**: Info
- **File**: `crawler/src/adapters/price-api.ts`
- **Issue**: If Nintendo adds a new `sales_status` value (e.g. `'soldout'`), it silently becomes `'not_found'`. This could cause confusion in the web UI.
- **Suggestion**: Log a warning when an unknown status is encountered. Consider adding a `raw_status` field to `PriceRecord` for debugging.

---

## Test Coverage Matrix

| Module | Has Tests? | Coverage Notes |
|---|---|---|
| `packages/shared/src/index.ts` (types) | Y | Type-level tests only (`expectTypeOf`). No runtime tests for `computeDiscountPercent`. |
| `packages/shared/src/index.ts` (`computeDiscountPercent`) | N | Exercised indirectly via adapter tests. No direct unit tests. |
| `crawler/src/adapters/switch-games.ts` | Y | Good coverage: `fetchGames`, `searchGames`, `getChineseGames`, `getOnSaleGames`, `fetchPrices`, `toGame`, `toPriceRecord`, `getAllGames`, `getDeals`. Edge cases: missing fields, empty API response. |
| `crawler/src/adapters/game-catalog.ts` | Y | Good coverage: valid HTML, empty HTML, malformed HTML, dedup, NSUID extraction from href and text. |
| `crawler/src/adapters/price-api.ts` (`parsePriceEntry`) | Y | Excellent coverage: on-sale, no-discount, not_found, gold_point, same-price-no-discount, preorder, unreleased. |
| `crawler/src/adapters/price-api.ts` (`chunkArray`) | Y | Good: various sizes, exact multiples, empty array. |
| `crawler/src/adapters/price-api.ts` (`fetchPriceBatch`) | Y | Good: error handling, retry, invalid response, query params. |
| `crawler/src/adapters/opencritic.ts` | Y | Good: `getTopGames`, `matchGamesWithScores`, `searchGame`, `getGame`, `findGameScore`, `findScoresForGames`. Edge: poor match, null score, API errors. |
| `crawler/src/services/delta.ts` | Y | Good: price decrease, new discount, unchanged, first snapshot, price increase. Missing: game removal detection. |
| `crawler/src/services/fetcher.ts` | Y | Good: `fetchCatalog`, `runFetch`, batch orchestration. |
| `crawler/src/services/persister.ts` (`writeLatest`) | Y | Good: create, overwrite, directory creation, valid JSON. |
| `crawler/src/services/persister.ts` (`readLatest`) | Y | Good: missing file, read back, corrupted JSON. |
| `crawler/src/services/persister.ts` (`appendDelta`) | ❌ FAIL | Tests exist but **fail** — function not implemented in source. 8 tests broken. |
| `crawler/src/services/persister.ts` (`readDeltas`) | ❌ FAIL | Tests exist but **fail** — function not implemented in source. 2 tests broken. |
| `crawler/src/services/persister.ts` (`writeGames`) | N | No tests. Complex merge logic untested. |
| `crawler/src/services/persister.ts` (`readGames`) | N | No tests. |
| `crawler/src/services/persister.ts` (`updateGameScores`) | N | No tests. Score update + force flag untested. |
| `crawler/src/services/persister.ts` (`writeDailySnapshot`) | N | No tests. |
| `crawler/src/services/persister.ts` (`readDailySnapshot`) | N | No tests. |
| `crawler/src/services/persister.ts` (`getLatestSnapshotDate`) | N | No tests. |
| `web/src/components/GameCard.vue` | Y | Good: render, price display, discount badge, strikethrough, ignore toggle, wishlist toggle, null price, platform badge. |
| `web/src/stores/preferences.ts` | Y | Good: ignore list CRUD, wishlist CRUD, localStorage persistence, corrupted data fallback, count, filter. |
| `web/src/composables/useLocalStorage.ts` | Y | Excellent: default values, stored values, update, objects, arrays, numbers, booleans, corrupted data, cross-tab sync. |

### Summary

- **140 tests total** (132 passing, 8 failing)
- **All 8 failures** are in `persister.test.ts` due to missing `appendDelta`/`readDeltas` implementations
- **Strongest coverage**: `price-api.ts` parser, `opencritic.ts`, web components/stores/composables
- **Weakest coverage**: `persister.ts` (6 untested exported functions + 2 broken tests), `computeDiscountPercent` (no direct tests)

---

## Outcome

**FAIL** — 8 broken tests (`appendDelta`/`readDeltas` not implemented), 6 untested exported functions in `persister.ts`, and several contract/documentation gaps.
