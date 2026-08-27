# Code Review Results — Switch-eShopRadar

> Review date: 2025-08-13
> Reviewer: AI Code Review Agent
> Scope: packages/shared, crawler, web, root config

---

## Summary

| Severity | Count |
|----------|-------|
| P0 · Critical | 0 |
| P1 · Major | 3 |
| P2 · Minor | 5 |
| P3 · Nitpick | 3 |

---

## P1 · Major

### 1. `loadHistory` 將 PriceDelta.changes 直接當作 PriceRecord[] 使用，導致 History 頁面資料不完整

- **檔案：** `web/src/services/data-loader.ts` — `loadHistory()`
- **描述：** `loadHistory` 函式從 `history/YYYY-MM.json` 讀取 `PriceDelta[]` 後，將每個 delta 的 `changes[].to` 直接 map 為 `PriceRecord`。但 `PriceDelta.changes[].to` 是 `Partial<PriceRecord>`（僅含變動欄位），不是完整的 PriceRecord。這導致 History 頁面顯示的遊戲缺少 `currency`、`regularPrice`、`salesStatus` 等欄位，呈現不完整的價格資料。
- **建議修復：**
  1. 將 `loadHistory` 回傳型別改為 `PriceDelta[]`，History 頁面直接顯示「變動紀錄」而非完整價格快照；或
  2. 讀取多日的 `latest.json` 快照重建完整價格；或
  3. crawler 在寫入 delta 時同時保存完整快照到 history。

---

### 2. OpenCritic title matching 使用 `includes()` 子字串比對，易產生誤配

- **檔案：** `crawler/src/adapters/opencritic.ts` — `matchGamesWithScores()`
- **描述：** 比對邏輯使用 `ocNameNormalized.includes(ourNameNormalized)` 和反向比對。當 normalize 後的名稱較短（如 `"zelda"`）時，會匹配到 `"superzeldabreath"` 等不相關遊戲，造成分數錯誤配對。同樣，較長的名稱也可能被子字串包含。
- **建議修復：**
  1. 僅在 normalize 後的名稱完全相等時才配對（exact match）；或
  2. 加入最小長度門檻（如 normalize 後長度 ≥ 5 才允許 `includes` 比對）；或
  3. 使用更嚴格的 matching 策略（如 Levenshtein distance 或 token-based matching）。

---

### 3. FilterBar 的 debounce timer 在元件卸載時未清除

- **檔案：** `web/src/components/FilterBar.vue`
- **描述：** `debouncedSearch` 使用模組級別的 `let debounceTimer` 變數。當使用者在 timer 觸發前導航離開頁面，timer 仍會執行並嘗試 emit 事件到已卸載的元件。雖然 Vue 3 會靜默忽略，但若 emit 有副作用（如 analytics），可能產生非預期行為。此外，多個 FilterBar 實例會共享同一個 `debounceTimer` 變數。
- **建議修復：** 在 `onUnmounted` / `onScopeDispose` 中清除 timer；或將 `debounceTimer` 改為元件內部的 `ref`。

---

## P2 · Minor

### 4. `web/src/types/index.ts` 與 `@eshop/shared` 型別重複定義

- **檔案：** `web/src/types/index.ts`
- **描述：** 該檔案自行定義了 `Game`、`PriceRecord`、`Platform`、`SalesStatus` 等型別，與 `packages/shared/src/index.ts` 中的型別相同。兩份型別可能隨時間分歧，造成上下游不一致。檔案內的 JSDoc 也提到「will be replaced once the shared package is fully established」。
- **建議修復：** 將 `web/src/types/index.ts` 改為 re-export `@eshop/shared` 的型別，或直接移除並改用 `@eshop/shared` import。

---

### 5. 多處靜默吞掉例外，無 logging 或 fallback 通知

- **檔案：** `crawler/src/services/persister.ts` — `writeGames()`、`readGames()`、`readLatest()`、`appendDelta()` 等
- **描述：** `writeGames()` 的 `catch {}` 在 JSON 讀取失敗時靜默忽略，繼續用空 Map 操作。這可能導致已有的 `games.json` 資料在解析失敗時被空資料覆蓋。`readGames()` 和 `readLatest()` 同樣在 JSON parse 失敗時回傳空值，無任何 logging。
- **建議修復：** 在 catch 區塊加入 `console.warn` 或 `console.error` 記錄異常，方便排查資料問題。

---

### 6. HTML 實體解碼清單不完整

- **檔案：** `crawler/src/adapters/game-catalog.ts` — `sanitizeTitle()`
- **描述：** `sanitizeTitle` 僅處理 6 種 HTML 實體（`&amp;`、`&lt;`、`&gt;`、`&quot;`、`&#39;`、`&#x27;`、`&nbsp;`）。遊戲標題可能包含其他 Unicode 實體（如 `&eacute;`、`&#8211;` 等），這些會殘留在標題中。
- **建議修復：** 使用完整的 HTML entity decode 函式庫（如 `he` package），或擴充常見實體清單。

---

### 7. `data-loader.ts` 重複定義 PriceSnapshot / PriceDelta 介面

- **檔案：** `web/src/services/data-loader.ts`
- **描述：** `data-loader.ts` 在檔案頂端自行定義了 `PriceSnapshot` 和 `PriceDelta` 介面（與 `@eshop/shared` 相同）。這與 issue #4 同源，但位於不同檔案，增加維護負擔。
- **建議修復：** 從 `@eshop/shared` 或 `@/types` import 這些型別。

---

### 8. `web/src/composables/useGamePage.ts` 縮排不一致

- **檔案：** `web/src/composables/useGamePage.ts`
- **描述：** `const games = computed(() => {` 內的 callback 體縮排為 1 格（非 2 格），與其他 computed property 風格不一致。如第 9-11 行：
  ```ts
  const games = computed(() => {
  const raw = getGames(gamesStore) as Game[];
  return prefsStore.filterIgnored(raw);
  });
  ```
- **建議修復：** 統一縮排為 2 格。

---

## P3 · Nitpick

### 9. `GameCard.vue` import 順序不一致

- **檔案：** `web/src/components/GameCard.vue`
- **描述：** `import { ref, computed } from 'vue'` 出現在 `<script setup>` 的中間位置（第 40 行），而非頂部。雖然功能正常，但違反慣例。
- **建議修復：** 將所有 import 移至 `<script setup>` 頂部。

---

### 10. `GameSkeleton.vue` 缺少 `<script setup lang="ts">` 區塊

- **檔案：** `web/src/components/GameSkeleton.vue`
- **描述：** 該元件僅有 `<template>` 和 `<style>`，無 `<script setup>` 區塊。雖然元件不需要 script，但加上空的 `<script setup lang="ts">` 可保持與其他元件的一致性，並啟用 TypeScript 型別檢查。
- **建議修復：** 加入 `<script setup lang="ts">` 空區塊（可選）。

---

### 11. `RetryButton.vue` 缺少 `aria-label`

- **檔案：** `web/src/components/RetryButton.vue`
- **描述：** 重試按鈕僅透過文字內容（「重新載入」）提供可及性資訊，無 `aria-label`。對於有 loading 狀態的按鈕，建議加上 `aria-label` 以清楚描述動作。此外 `aria-live` 可考慮加在父容器上以通知螢幕閱讀器載入狀態變更。
- **建議修復：** 加入 `aria-label="重新載入遊戲資料"`。

---

## Positive Observations

- **安全性良好：** 無硬編碼 API key，所有 secret 透過環境變數傳入。
- **型別安全：** `@eshop/shared` 型別定義清晰，無 `any` 泄漏。
- **Atomic write：** `persister.ts` 的 `atomicWrite` 使用 backup/restore 策略，保護資料完整性。
- **Retry + rate limit：** 爬蟲的 HTTP 請求有重試邏輯和 rate limiting，對外部 API 友善。
- **輸入淨化：** `game-catalog.ts` 對 HTML 解析結果有完善的 sanitize（NSUID regex、title clean、cover URL 驗證）。
- **測試覆蓋：** 各模組有對應的 `__tests__/` 單元測試，覆蓋主要路徑。
- **無障礙：** 元件使用 `role`、`aria-label`、`aria-live`、`focus-visible` 等無障礙屬性。
- **RWD：** CSS 有完整的 mobile/tablet/desktop breakpoint 設計。

---

*Reviewed files: 40 source files across packages/shared, crawler, web, and root config.*
