# Web Layer Code Review — 2026-08-28

**Outcome: OK** (with warnings)

## Summary

The web layer is well-structured overall: Composition API `<script setup>` is used consistently, Pinia stores are idiomatic, the `data-loader` has thoughtful error handling (404 fallback, timeout), and the component tree (GameGrid → GameCard) handles loading/error/empty states cleanly. CSS uses design tokens consistently and the router uses lazy-loaded routes.

**Key concerns**: Significant code duplication across the three page views (identical filtering/sorting logic copy-pasted), a disconnect between store-level filter state and per-view local state, and no pagination/virtual scrolling for potentially large game lists. None are critical — the app functions correctly — but the duplication will become a maintenance burden as features grow.

---

## Issues

### 1. Code Duplication — Filtering & Sorting Logic (×3 views)

- **Severity**: Warning
- **Files**: `web/src/views/HotPage.vue`, `web/src/views/DealsPage.vue`, `web/src/views/NewReleasesPage.vue`
- **Issue**: All three page views contain a nearly identical `filteredGames` computed property (~30 lines each) that duplicates the same platform filtering, search filtering, and sort logic. The only differences are: (a) the default `sortBy` value and (b) which store getter the games come from. This violates DRY and means any filter/sort bug must be fixed in three places.
- **Suggestion**: Extract the filtering/sorting logic into a reusable composable, e.g. `useFilteredGames(games, options)` that accepts the raw game list and filter state refs. Alternatively, since the store already has `platformFilter`, `searchQuery`, and `sortBy` refs, move the filtering logic into the store itself and have views simply consume `filteredGames`. The store already has this computed — the views just don't use it because they need per-page overrides (e.g. HotPage only shows `hotGames`).

### 2. Store Filter State Is Unused by Views

- **Severity**: Warning
- **File**: `web/src/stores/games.ts`
- **Issue**: The store exposes `platformFilter`, `searchQuery`, `sortBy`, and `filteredGames` computed, but no view consumes them. Each view creates its own local `ref()` for these filters. The store's filter state becomes dead code that can drift out of sync with actual behavior.
- **Suggestion**: Either (a) remove the filter state from the store if views are meant to own it locally, or (b) have views bind to the store's filter state via `storeToRefs()` and let the store's `filteredGames` be the single source of truth. Option (b) is better if you want filter state to persist across route navigation.

### 3. Data Loader Swallows 404s as Empty — Error Signal Lost

- **Severity**: Warning
- **File**: `web/src/services/data-loader.ts`
- **Issue**: `loadGames()` and `loadLatestPrices()` catch `NotFoundError` (404) and return `[]`. The store then sets `error.value = null` because no exception is thrown. When games.json doesn't exist (first deploy, crawler not yet run), the user sees an empty grid with no explanation — the "empty state" UI shows "暫無資料" which is ambiguous (is data loading? or does it not exist?).
- **Suggestion**: Distinguish between "no data available yet" (404) and "data exists but failed to load" (network/5xx). Options: (a) return a result object like `{ data: Game[], source: 'ok' | 'not-found' | 'error' }` from the loader, or (b) have the store set a more specific error message like "資料尚未產生" for 404 vs "載入失敗" for network errors. The `NotFoundError` class is already defined — just don't swallow it silently.

### 4. No Pagination or Virtual Scrolling

- **Severity**: Warning
- **File**: `web/src/components/GameGrid.vue`, `web/src/views/*.vue`
- **Issue**: The game grid renders all filtered games in a single `<div>` with `v-for`. If the catalog grows to thousands of games, this will cause slow initial render and high DOM node count. The `loading="lazy"` on images helps with image loading, but all GameCard components are still mounted into the DOM.
- **Suggestion**: For now this is acceptable if the catalog stays under ~500 games. If it grows, consider: (a) a simple "show more" pagination (render first 50, load more on scroll/button), or (b) virtual scrolling (e.g. `@tanstack/vue-virtual` or `vue-virtual-scroller`). A cheap interim fix: limit `v-for` to the first N items with a "Load more" button.

### 5. PillFilter Emits Untyped String — Requires Casts

- **Severity**: Info
- **File**: `web/src/components/PillFilter.vue`, `web/src/components/FilterBar.vue`
- **Issue**: `PillFilter` defines `Option.value` as `string` and emits `update:modelValue` with `string`. FilterBar then casts the value: `@update:model-value="emit('update:platformFilter', $event as Platform | 'all')"`. This works but loses type safety — any string could slip through.
- **Suggestion**: Make PillFilter generic: `<T extends string>` so that `Option<T>` has `value: T` and the emit is typed as `T`. Then FilterBar can use `PillFilter<Platform | 'all'>` and `PillFilter<'title' | 'price' | 'discount'>` for full type safety without casts.

### 6. `fetchJson` Timeout Races with External AbortSignal

- **Severity**: Info
- **File**: `web/src/services/data-loader.ts`
- **Issue**: `fetchJson` creates an internal `AbortController` and merges with the passed `signal` via `signal: signal ?? controller.signal`. If the caller passes a signal AND the timeout fires, both controllers try to abort — this works (first abort wins), but the intent is unclear. More importantly, if the caller's signal is already aborted when `fetchJson` is called, the fetch will still proceed with the internal controller's timeout.
- **Suggestion**: Check the caller's signal first: `if (signal?.throwIfAborted())` or `signal?.addEventListener('abort', ...)` before starting the fetch. Also consider composing signals properly:
  ```ts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  ```

### 7. `useGamePage` Guards Fetch with `games.length === 0` — Stale Data Risk

- **Severity**: Info
- **File**: `web/src/composables/useGamePage.ts`
- **Issue**: `onMounted` only calls `fetchGames()` if `gamesStore.games.length === 0`. If the user navigates away and back, or if data was updated by the crawler, the stale cached data is shown. There's no TTL or background refresh.
- **Suggestion**: For a radar/deals app, data freshness matters. Options: (a) always fetch on mount (with a debounce/throttle to avoid hammering the server on rapid navigation), (b) fetch in the background and show stale data until fresh data arrives, or (c) add a timestamp to the store and refetch if data is older than N minutes. Option (a) is simplest and sufficient given the data is static JSON files.

### 8. `hotGames` Computed Re-sorts on Every Access

- **Severity**: Info
- **File**: `web/src/stores/games.ts`
- **Issue**: `hotGames` creates a new array, maps over all games to compute discount, sorts, and slices — on every reactive access. If `games` or `prices` change (e.g. during fetch), this re-runs. For 500+ games this is fine, but the pattern is repeated in `dealsGames` and `newReleases`.
- **Suggestion**: Vue's computed caching handles this well — it only re-runs when dependencies change. No action needed unless profiling shows it's a bottleneck. Just be aware that `.map().sort().slice()` creates intermediate arrays; for very large datasets, a single-pass approach would be more efficient.

### 9. `useLocalStorage` Watch with `flush: 'sync'`

- **Severity**: Info
- **File**: `web/src/composables/useLocalStorage.ts`
- **Issue**: The watch uses `flush: 'sync'`, meaning localStorage is written on every synchronous reactive update. If `addToIgnoreList` spreads the array twice (once for ignoreList, once for the parent object), localStorage is written twice per call. This is fine for small data but could cause jank if the pattern grows.
- **Suggestion**: Consider `flush: 'post'` to batch writes to the next tick. The current behavior is correct and safe — this is a minor optimization note, not a bug.

### 10. No Skeleton Animation CSS

- **Severity**: Info
- **File**: `web/src/components/GameSkeleton.vue`
- **Issue**: The skeleton uses a `.skeleton` class but the CSS doesn't define the shimmer/pulse animation. The skeleton renders as static gray boxes without the typical loading animation.
- **Suggestion**: Add the animation in `styles.css` or the component:
  ```css
  .skeleton {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  ```

### 11. `GameGrid` Error State Inline SVG vs Reusable Icon

- **Severity**: Info
- **File**: `web/src/components/GameGrid.vue`
- **Issue**: The error state and empty state use inline SVG for the error icon and empty state illustration, while other icons (SearchIcon, StarIcon, etc.) are extracted as components. This is inconsistent — the error/empty icons can't be reused or themed easily.
- **Suggestion**: Extract the error icon and empty state illustration into dedicated icon components (e.g. `ErrorIcon.vue`, `EmptyStateIcon.vue` — note `EmptyStateIcon.vue` already exists in the icons directory but isn't used here).

### 12. Router Uses Hash History — Minor SEO/UX Impact

- **Severity**: Info
- **File**: `web/src/router/index.ts`
- **Issue**: `createWebHashHistory()` produces URLs like `/#/hot`. This is fine for a SPA that doesn't need SEO, but hash URLs look less clean and can't be deep-linked with server-side rendering.
- **Suggestion**: If this is a purely client-side tool (no SEO needs), hash history is fine and avoids server config for SPA fallback. If you ever want cleaner URLs (`/hot` instead of `/#/hot`), switch to `createWebHistory()` and configure your server (or Vite dev server) to serve `index.html` for all routes.

### 13. `FilterBar` Search Clear Button Doesn't Reset Input Visually

- **Severity**: Info
- **File**: `web/src/components/FilterBar.vue`
- **Issue**: The search clear button emits `update:searchQuery` with `''`, but the input's `:value` is bound to the prop. After clearing, the debounce timer may still fire with the old value if the user clicked clear and then the timer from a previous keystroke fires. The `clearTimeout` in `debouncedSearch` mitigates this for new keystrokes, but the clear button bypasses `debouncedSearch`.
- **Suggestion**: The clear button correctly emits immediately (no debounce needed for clear), and `debouncedSearch` is only called on `@input`. This is actually correct — the clear sets the value directly. No bug, just noting the flow is clear.

### 14. `computeDiscountPercent` Called Multiple Times Per Game

- **Severity**: Info
- **Files**: `web/src/stores/games.ts`, `web/src/views/*.vue`, `web/src/components/GameCard.vue`
- **Issue**: `getDiscountPercent` is called in the store's `filteredGames` (for sorting), in the view's `filteredGames` (for sorting), and in `GameCard` (for display). For a game in the "discount" sort, the percent is computed at least 3 times. This is cheap math but conceptually redundant.
- **Suggestion**: Pre-compute `discountPercent` on each game during `fetchGames` or in the store's computed, and pass it through. This avoids repeated computation and makes the data flow clearer.

---

## Positive Observations

1. **Consistent Composition API**: All components use `<script setup lang="ts">` — no Options API remnants.
2. **Good separation of concerns**: `useGamePage` composable encapsulates page-level logic; `useLocalStorage` handles persistence; `data-loader` handles network.
3. **Thoughtful error handling in data-loader**: `NotFoundError` class, timeout with AbortController, fallback for 404s.
4. **Accessibility basics covered**: `role="radiogroup"`, `aria-checked`, `aria-label`, `role="alert"` on error, `aria-live="polite"` on skeletons, `focus-visible` styles, keyboard navigation in PillFilter.
5. **Design token usage**: All CSS uses `var(--gap-*)`, `var(--fs-*)`, `var(--radius-*)` etc. — consistent and themeable.
6. **Lazy-loaded routes**: All page components are dynamically imported.
7. **Cross-tab sync**: `useLocalStorage` listens for `storage` events and cleans up with `onScopeDispose`.
8. **Mobile RWD**: Every component has `@media (max-width: 767px)` breakpoints with appropriate layout changes.
9. **Image fallback**: `GameCard` handles broken cover images with an inline SVG fallback.
10. **`prefers-reduced-motion`**: The retry button's spin animation respects reduced motion.
