# Switch eShop Radar — Code Review

**審查日期：** 2026-08-23  
**審查標準：** 資深工程師 Code Review 標準  
**覆蓋範圍：** 全部原始碼（crawler / shared / web），105 tests all passing

---

## 總體評價

| 維度 | 評分 | 說明 |
|------|------|------|
| 架構設計 | ⭐⭐⭐⭐ | Monorepo 分層合理，職責分離清楚 |
| 程式碼品質 | ⭐⭐⭐⭐ | 命名、型別、結構都很好，有幾個可改善點 |
| 測試覆蓋 | ⭐⭐⭐⭐ | 核心路徑覆蓋完整，缺少整合測試 |
| 錯誤處理 | ⭐⭐⭐ | 基本都有，但部分靜默吞錯誤 |
| 安全性 | ⭐⭐⭐ | 基本 OK，有 XSS surface 可以收緊 |
| 可維護性 | ⭐⭐⭐⭐ | 模組化良好，少量重複邏輯可抽取 |

---

## 🔴 Must Fix（阻斷性問題）

### 1. `useGamePage` 中的 type unsafe — `getGames` 回傳型別錯誤

**檔案：** `web/src/composables/useGamePage.ts:6-8`

```ts
export function useGamePage(
  getGames: (gamesStore: ReturnType<typeof useGamesStore>) => unknown[],
) {
```

`getGames` 的回傳型別是 `unknown[]`，但下游直接 iterate 當作 `Game[]` 使用。這會導致型別安全完全失效，`GameCard` 收到 `unknown` 會報錯（實際靠型別斷言繞過）。

**修正：** 使用泛型或明確型別：

```ts
export function useGamePage<T extends Game>(
  getGames: (gamesStore: ReturnType<typeof useGamesStore>) => T[],
) {
```

或在返回值加上型別：

```ts
const games = computed(() => getGames(gamesStore) as Game[]);
```

---

### 2. `useLocalStorage` 在 composable 外直接呼叫 `window.addEventListener`

**檔案：** `web/src/composables/useLocalStorage.ts:41-43`

```ts
if (typeof window !== 'undefined') {
  window.addEventListener('storage', onStorageChange);
}
```

問題：
- 如果同一個 composable 被呼叫多次（多個 store 共用同一個 key），會註冊多個 listener
- listener 在 `setup()` 外同步執行，但只在 `onUnmounted` 清理 — 如果 composable 在組件建立前就被呼叫（如 store 中），`onUnmounted` 不會觸發
- Vue 官方會產生 `onUnmounted is called when there is no active component instance` 的警告（目前測試中有）

**修正：** 移到 `onMounted` 內，或改用 `watchEffect` + `onScopeDispose`：

```ts
import { onScopeDispose } from 'vue';

// 在 composable 內
onScopeDispose(() => {
  window.removeEventListener('storage', onStorageChange);
});
```

`onScopeDispose` 在 Pinia store 內和 component setup 內都能正確觸發。

---

## 🟡 Should Fix（強烈建議修正）

### 3. 雙重折扣計算邏輯 — DRY 原則違反

折扣百分比在三個地方獨立計算：
- `crawler/src/adapters/price-api.ts:parsePriceEntry()`
- `web/src/stores/games.ts:getDiscountPercent()`
- `web/src/components/GameCard.vue:discountPercent` computed

三處邏輯幾乎一樣，但有微妙差異（crawler 版本用 `Math.round`，store 版本也用 `Math.round`，GameCard 版本也用 `Math.round`）。如果未來修改公式，很容易漏改一處。

**建議：** 在 `packages/shared` 提供 `computeDiscountPercent(regular: number, discount: number): number`，三處統一呼叫。

---

### 4. `fetcher.ts` 重複了 `price-api.ts` 的 batch 邏輯

`fetcher.ts:52-62` 的 chunk + rate-limit 邏輯和 `TWPriceApi.fetchPrices()` 完全一樣：

```ts
// fetcher.ts (重複)
const chunks = chunkArray(nsuids, BATCH_SIZE);
for (let i = 0; i < chunks.length; i++) {
  const prices = await fetchPriceBatch(chunks[i], priceApiBaseUrl, { country, lang });
  allPrices.push(...prices);
  if (i < chunks.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

而 `TWPriceApi` 已經封裝了完全一樣的邏輯。`fetcher.ts` 直接使用 `TWPriceApi` 即可，不需要自己再做一次 batch。

**建議：** `runFetch` 改為注入 `PriceAdapter`，直接呼叫 `adapter.fetchPrices(nsuids)`。

---

### 5. `data-loader.ts` 重複的 timeout pattern

三個 function（`loadGames`、`loadLatestPrices`、`loadHistory`）有完全一樣的 `AbortController + setTimeout + clearTimeout` pattern。抽取一個 helper：

```ts
async function fetchWithTimeout<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: signal ?? controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### 6. `preferences store` 中的 `filterIgnored` 未被使用

`usePreferencesStore` 的 `filterIgnored()` 在 store 中定義了，但没有任何地方呼叫它。三個 page 的 `useGamePage` 都沒有用到這個功能，被 ignore 的遊戲仍然會顯示（只是 opacity 0.5）。

這可能是未完成的功能，但目前的 UX 是：忽略的遊戲仍然佔據畫面位置。

**建議：** 要嘛在 `useGamePage` 中呼叫 `prefsStore.filterIgnored()` 真正過濾掉，要嘛移除這個死code。

---

### 7. `GameCard` 中的 image error fallback 使用 inline SVG data URI

**檔案：** `web/src/components/GameCard.vue:30-31`

```ts
@error="($event.target as HTMLImageElement).src = 'data:image/svg+xml,...'"
```

問題：
- `@error` handler 沒有 prevent loop — 如果 fallback SVG 也觸發 error（理論上不會，但 defensive programming 應該檢查）
- 內聯 SVG data URI 很長，難以維護

**建議：** 抽取為常數或 import 一個 fallback image。

---

### 8. `game-catalog.ts` 的正則表達式可能匹配到非 NSUID 的數字

`NSUID_REGEX = /\b7001\d{10}\b/g` — 會匹配到任何以 7001 開頭的 14 位數字，包括：
- 電話號碼
- 時間戳記
- 其他 ID

在 `.text()` 全文掃描（Strategy 3）中尤其容易產生 false positive。

**建議：** 只保留 Strategy 1（href 抽取），Strategy 2 和 3 作為 fallback 應該加上更嚴格的上下文驗證（例如要求在特定 class 內）。

---

## 🟢 Nice to Have（建議改善）

### 9. 缺少 `.env.example` 或 `.env.defaults`

`crawler/src/index.ts` 使用 `process.env.CATALOG_URL ?? '...'` 讀取環境變數，但沒有文件說明有哪些環境變數可用。

**建議：** 加入 `.env.example` 文件。

---

### 10. `persister.ts` 的 atomic write 在 Windows 上可能失敗

`fs.renameSync(tmpPath, filePath)` 在 Windows 上如果目標檔案已存在會失敗（不支援 overwrite rename）。

**建議：** 使用 `fs.writeFileSync` 直接寫入（目前 `writeLatest` 就是直接 write），或使用 `fs.rmSync` 先刪除再 rename。

---

### 11. 缺少 `AbortController` 在 `useGamePage` 中的 cleanup

`useGamePage` 在 `onMounted` 觸發 `fetchGames`，但沒有在 `onUnmounted` 取消 pending request。如果使用者快速切換頁面，可能有多個並行的 fetch。

**建議：** 在 `useGamePage` 或 `gamesStore` 中加入 request cancellation。

---

### 12. Web 層缺少 E2E 測試

目前只有 unit test，沒有 E2E 測試。對於這種資料驅動的 UI，建議加入 Playwright 測試驗證：
- 頁面載入後正確顯示遊戲卡片
- 搜尋過濾功能正常運作
- 忽略/願望清單的 localStorage 持久化

---

### 13. 缺少 ESLint / Prettier config

`package.json` 有 `lint` 和 `format` script，但沒有找到 `.eslintrc` 或 `eslint.config` 文件。

**建議：** 補上 ESLint + Prettier config。

---

### 14. `shared` package 沒有自己的 vitest.config

`vitest.workspace.ts` 包含 `packages/shared`，但 `packages/shared` 沒有 `vitest.config.ts`，也沒有 test files。要嘛加入 config，要嘛從 workspace 移除。

---

### 15. 型別重複：`web/src/types/index.ts` vs `packages/shared/src/index.ts`

兩個 package 定義了相似但不完全相同的型別。`web/src/types` 有 `Preferences` 但沒有 `PriceSnapshot` / `PriceDelta`；`shared` 有完整的 price 類型但沒有 `Preferences`。

長期來看，web 層應該直接 import `@eshop/shared`，移除 `web/src/types`。

---

### 16. 缺少 `robots.txt` / SEO 設定

這是一個 public-facing 的 SPA，但沒有 SEO 相關設定。如果需要被搜尋引擎收錄，建議加入 meta tags 和 `robots.txt`。

---

## 優點（做得好的地方）

1. **Monorepo 架構** — `packages/shared` / `crawler` / `web` 分離清楚，`@eshop/shared` 的 workspace symlink 設定正確
2. **Delta 機制** — `computeDelta` 的 idempotent 設計很好，避免重複記錄
3. **Atomic write** — `persister.ts` 的 `tmp + rename` 模式是正確的檔案寫入最佳實踐
4. **Rate limiting** — crawler 有適當的 rate limit 和 retry 機制
5. **RWD 設計** — CSS 的 mobile/tablet/desktop breakpoint 切分合理
6. **Accessibility** — `PillFilter` 的 radiogroup role + keyboard navigation + `focus-visible` 都有做到
7. **Test coverage** — 105 tests 覆蓋了核心商業邏輯、data persistence、component rendering

---

## 修正優先順序

| 優先 | 項目 | 工作量 |
|------|------|--------|
| P0 | #1 型別安全 `unknown[]` | 10 min |
| P0 | #2 `useLocalStorage` listener 泄漏 | 15 min |
| P1 | #6 `filterIgnored` 死code 清理 | 10 min |
| P1 | #5 `data-loader` DRY 重構 | 15 min |
| P1 | #4 `fetcher` 去除重複 batch 邏輯 | 20 min |
| P2 | #3 折扣計算統一 | 20 min |
| P2 | #11 AbortController cleanup | 15 min |
| P2 | #8 NSUID regex 嚴格化 | 15 min |
| P3 | #9~#16 其他改善 | 各 10-30 min |
