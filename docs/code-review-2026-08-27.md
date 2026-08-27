# Code Review Report

**專案：** Switch eShop Radar  
**審查日期：** 2026-08-27  
**審查範圍：** `crawler/src/`, `web/src/`, `packages/shared/`  
**審查人：** AI Senior Engineer

---

## 📊 整體評分：7.5 / 10

整體架構清晰、分層合理、型別系統完整。主要扣分項在於：XSS 潛在風險、型別重複維護、部分邊界情境缺乏處理、以及部分模組測試覆蓋不足。

---

## 🔴 嚴重問題（Must Fix）

### [R1] `web/src/components/GameCard.vue` — 圖片 `onerror` 的 DOM 操作有 XSS 風險

**行號：** ~55-63

**問題：** 圖片 `onerror` 事件直接用 `$event.target as HTMLImageElement` 操作 DOM，且 fallback 圖片使用 `data:image/svg+xml` URI。若 `game.coverUrl` 來自爬蟲抓取的 HTML（cheerio 解析），攻擊者可在 HTML 中注入惡意的 NSUID 連結，其 `coverUrl` 可能指向含惡意 JS 的 data URI。

```vue
@error="($event.target as HTMLImageElement).src = 'data:image/svg+xml,...'"
```

**建議修復：**
1. 在 `parseNintendoTWCatalogHtml` 中對 `coverUrl` 做 URL 白名單驗證（僅允許 `https://` 開頭的圖片 URL）
2. 使用 CSS `background-image` fallback 取代 JS 設定 `src`，或使用 Vue 的 `v-bind:src` 綁定 reactive 變數而非直接操作 DOM

---

### [R2] `crawler/src/adapters/game-catalog.ts` — HTML 解析未對輸入做 sanitization

**行號：** `parseNintendoTWCatalogHtml` 整個函式

**問題：** `cheerio.load(html)` 直接解析來自外部的 HTML。若 Nintendo 頁面被 XSS 攻擊或返回惡意內容，cheerio 可能提取出 XSS payload。此外，`$()` 選擇器直接使用外部 HTML 構建 DOM，無任何白名單過濾。

**建議修復：**
1. 對解析結果做 URL 協議驗證（`href` 只允許相對路徑或 `https://`）
2. 對 `title` 做 HTML entity decoding 後再 trim，避免 XSS payload 殘留在 title 中
3. 使用 `cheerio` 的 `html` 選項限制解析範圍

---

### [R3] `crawler/src/services/fetcher.ts` — `fetchCatalog` 無錯誤處理

**行號：** ~19-22

**問題：** `fetchCatalog` 直接 `await ofetch(url)` 但無 try-catch。若 Nintendo 頁面 503、超時、或返回非 HTML 內容，異常會直接向上拋出，導致 `main()` 的 `catch` 立即 exit(1)，且無法提供有意義的錯誤資訊。

```typescript
export async function fetchCatalog(url: string): Promise<ParsedCatalogEntry[]> {
  const response = await ofetch(url, { responseType: 'text' });
  const html = String(response);
  return parseNintendoTWCatalogHtml(html);
}
```

**建議修復：**
1. 加入 `responseType: 'text'` 的明確指定（已有）
2. 加入回應狀態碼檢查：若非 200 則拋出明確錯誤
3. 加入 HTML 內容校驗（至少檢查是否包含 `<html>` 或 `<body>` 標籤）
4. 在 `parseNintendoTWCatalogHtml` 入口加 `typeof html !== 'string'` 的防禦（已有，但呼叫端未處理）

---

### [R4] `web/src/services/data-loader.ts` — `loadHistory` 安靜失敗，使用者無感知

**行號：** ~56-62

**問題：** `fetchJsonWithFallback` 在 fetch 失敗時返回 fallback 值，但 `loadHistory` 使用此模式意味着：網路中斷、CORS 錯誤、或 404 時，使用者看到空的歷史資料卻不知道為什麼。

```typescript
async function fetchJsonWithFallback<T>(url: string, fallback: T, signal?: AbortSignal): Promise<T> {
  try {
    return await fetchJson<T>(url, signal);
  } catch {
    return fallback; // 靜默吞掉所有錯誤
  }
}
```

**建議修復：**
1. 區分 404（正常，歷史資料可能不存在）和其他錯誤（網路問題）
2. 404 返回 fallback，其他錯誤向上拋出或設置 error state
3. 在 UI 層顯示「載入歷史失敗」的提示

---

### [R5] `crawler/src/services/persister.ts` — 原子寫入失敗時不保留原檔案

**行號：** ~134-145（`appendDelta` 函式）

**問題：** `appendDelta` 使用 tmp 檔案 + rename 的原子寫入策略，但 rename 失敗後只刪除 tmp 檔案，不嘗試恢復原檔案。若 rename 失敗是因為原檔案被其他 process 鎖住，可能導致資料丟失。

```typescript
try {
  fs.writeFileSync(tmpPath, JSON.stringify(existing, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
} catch (err) {
  try {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch { /* ignore cleanup errors */ }
  throw err;
}
```

**建議修復：**
1. 在 rename 前先備份原檔案（`filePath.bak`）
2. rename 失敗時嘗試從備份還原
3. 記錄 backup 檔案的清理策略（例如下次 successful write 時清理）

---

## 🟡 建議改進（Should Fix）

### [Y1] `web/src/types/index.ts` vs `packages/shared/src/index.ts` — 型別重複定義

**問題：** `web/src/types/index.ts` 與 `packages/shared/src/index.ts` 定義了幾乎相同的 `Game`、`PriceRecord` 型別，但有微妙差異：

- `Game.coverUrl`：shared 是 `string`，web 也是 `string`（一致）
- `Game.releaseDate`：shared 是 `string`（ISO date），web 也是 `string`（一致）
- `PriceRecord.currency`：shared 是 `'TWD'`（literal type），web 是 `'TWD'`（一致）
- `PriceRecord` 的 `goldPoint` 結構：兩邊一致

雖然目前一致，但未來修改 shared 時很容易忘記同步更新 web 端的 types。

**建議修復：**
1. 從 `web/src/types/index.ts` 移除重複型別，直接 `import type { Game, PriceRecord } from '@eshop/shared'`
2. 或使用 `web/src/types/index.ts` 作為 re-export layer

---

### [Y2] `web/src/stores/games.ts` — `hotGames` / `dealsGames` / `newReleases` 重複建立物件

**行號：** ~42-70

**問題：** 三個 computed 都會 `.map(g => ({ ...g, discountPercent: getDiscountPercent(g.id) }))` 建立新物件。當 `games.value` 有數千筆時，每次 computed recompute 都會建立大量暫存物件。

```typescript
const hotGames = computed(() => {
  return [...games.value]
    .map((g) => ({ ...g, discountPercent: getDiscountPercent(g.id) }))
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 20);
});
```

**建議修復：**
1. 使用 `shallowRef` + `triggerRef` 或手動 memoize `discountPercent` 計算結果
2. 或在 `games` store 中預先計算 `discountPercent` 並存入 game 物件

---

### [Y3] `web/src/composables/useGamePage.ts` — `onMounted` 缺少載入狀態完整判斷

**行號：** ~18-20

**問題：** `onMounted` 只檢查 `!gamesStore.loading && gamesStore.games.length === 0`，但未考慮 `gamesStore.error` 狀態。若上次 fetch 失敗，error 不為空但 games 為空，重新導頁時會再次嘗試 fetch（這是好的），但若使用者已按 Retry 且正在 loading 中，onMounted 不會觸發（這是好的）。邏輯正確但不夠明確。

```typescript
onMounted(() => {
  if (!gamesStore.loading && gamesStore.games.length === 0) {
    gamesStore.fetchGames();
  }
});
```

**建議修復：**
1. 改為更明確的語意：`if (!gamesStore.loading && !gamesStore.error && gamesStore.games.length === 0)`
2. 或將此邏輯抽到 Pinia store 的 `initialize()` action 中統一管理

---

### [Y4] `web/src/components/FilterBar.vue` — debounce timer 生命週期管理

**行號：** ~39-44

**問題：** `debounceTimer` 是 module-level 變數，非 `ref` 或 `onScopeDispose` 管理。若 FilterBar 被 unmount 後重新 mount，timer 可能還活著且指向舊的 emit callback。

```typescript
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSearch(value: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:searchQuery', value);
  }, 300);
}
```

**建議修復：**
1. 使用 `onScopeDispose(() => { if (debounceTimer) clearTimeout(debounceTimer); })` 清理
2. 或改為 `ref<number | null>(null)` 配合 `watch` + `debounce` 使用 composable

---

### [Y5] `crawler/src/adapters/price-api.ts` + `opencritic.ts` — `sleep()` helper 重複

**問題：** 兩個檔案各自定義了相同的 `sleep()` 函式：

```typescript
// price-api.ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// opencritic.ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**建議修復：** 抽取到 `packages/shared/src/utils.ts` 或 `crawler/src/utils.ts` 統一管理。

---

### [Y6] `crawler/src/services/delta.ts` — 移除的遊戲未被追蹤

**行號：** ~38-40

**問題：** `computeDelta` 遍歷 oldMap 中消失的 id 時，有 `// Could track removals if needed; for now skip` 的 TODO 但未實現。若某遊戲從 Nintendo 頁面下架，delta 不會記錄此事件。

```typescript
// Games removed from new snapshot
for (const [id] of oldMap) {
  if (!newMap.has(id)) {
    // Could track removals if needed; for now skip
  }
}
```

**建議修復：**
1. 在 `PriceDelta.changes` 中新增 `type: 'added' | 'removed' | 'modified'` 欄位
2. 或至少在 delta 中記錄 removed games 的 id，方便後續分析

---

### [Y7] `web/src/stores/games.ts` — `filteredGames` 缺少 memoization

**行號：** ~17-40

**問題：** `filteredGames` 是 `computed`，但每次 recompute 都建立新陣列。若 `games` 很大（數千筆），且 `platformFilter`/`searchQuery` 頻繁變動，可能造成效能問題。

**建議修復：**
1. 使用 `computed` + `shallowRef` 減少深層比較
2. 或在 filter 函式中加入 early return（例如空 query 時直接返回全部）

---

### [Y8] `web/src/stores/games.ts` — 缺少測試覆蓋

**問題：** `games` store 是前端核心邏輯，但 `web/src/__tests__/stores/` 只有 `preferences.test.ts`，缺少 `games.test.ts`。

**建議修復：** 新增以下測試：
- `fetchGames` 成功/失敗
- `filteredGames` 各種 filter + sort 組合
- `hotGames` / `dealsGames` / `newReleases` 的計算邏輯
- `getDiscountPercent` 邊界情況（undefined、0、負數）

---

### [Y9] `web/src/services/data-loader.ts` — `loadHistory` 的 delta 轉換邏輯有問題

**行號：** ~46-58

**問題：** `loadHistory` 將 `PriceDelta[]` 轉換為 `Record<string, PriceRecord[]>` 時，只取了 `delta.changes` 中的 `to` 欄位。但 `to` 是 `Partial<PriceRecord>`，不是完整的 `PriceRecord`。這意味着返回的資料缺少 `regularPrice`、`salesStatus` 等必要欄位。

```typescript
const prices: PriceRecord[] = delta.changes
  .filter((c) => c.to && 'id' in c.to)
  .map((c) => c.to as PriceRecord);
```

**建議修復：**
1. 補充 `to` 的預設值（`regularPrice: 0`, `salesStatus: 'not_found'` 等）
2. 或改為返回 `Partial<PriceRecord>[]` 並在 UI 層處理 undefined 欄位

---

### [Y10] `web/src/__tests__/components/GameCard.test.ts` — 使用文字比對斷言

**行號：** ~35-36, 50-51

**問題：** 測試使用 `wrapper.text().toContain('NT$')` 和 `toContain('1,490')` 進行斷言，這種方式過於寬鬆，可能因 UI 文案變更而誤判。例如 `toContain('NT$')` 會匹配任何包含 "NT$" 的文字。

```typescript
expect(wrapper.text()).toContain('NT$');
expect(wrapper.text()).toContain('1,490');
```

**建議修復：**
1. 使用 CSS selector 定位特定元素：`wrapper.find('.game-card__current-price').text()`
2. 使用 `data-testid` 屬性精確定位

---

### [Y11] `crawler/src/adapters/opencritic.ts` — 標題比對邏輯過於寬鬆

**行號：** ~72-82

**問題：** `matchGamesWithScores` 使用 `includes()` 進行標題比對，可能導致誤配。例如 "Mario" 會匹配 "Super Mario"、"Paper Mario"、"Mario Kart" 等。

```typescript
if (
  ocNameNormalized === ourNameNormalized ||
  ocNameNormalized.includes(ourNameNormalized) ||
  ourNameNormalized.includes(ocNameNormalized)
)
```

**建議修復：**
1. 改用更精確的比對策略（如 Levenshtein distance、Jaccard similarity）
2. 或至少要求較短的字串長度 >= 5 才允許 substring match
3. 加入 threshold（如 normalized 距離 < 0.2）

---

### [Y12] `crawler/src/adapters/price-api.ts` — `getHttpStatus` 使用 regex fallback

**行號：** ~93-100

**問題：** `getHttpStatus` 使用 regex `/\b([45]\d{2})\b/` 從錯誤訊息中提取 HTTP 狀態碼。若錯誤訊息包含 "404" 在其他上下文中（如 "error code 4044"），可能誤判。

```typescript
const match = err.message.match(/\b([45]\d{2})\b/);
return match ? parseInt(match[1], 10) : undefined;
```

**建議修復：**
1. 優先使用 ofetch 的 `FetchError` 型別（若有）
2. 限制 regex 匹配範圍（如只在 "status" 關鍵字後搜尋）
3. 或直接依賴 ofetch 的 response 物件取得 status

---

## 🟢 優點（Good Things）

### ✅ 架構設計優秀
- **Crawler 分層清晰**：adapters（外部 API）→ services（業務邏輯）→ index.ts（排程器），职责分明
- **Web 前端分層合理**：stores（狀態管理）→ composables（可複用邏輯）→ views/components（UI）
- **Monorepo 結構**：`packages/shared` 共享型別，避免 type 定義散落

### ✅ 型別系統完整
- 所有模組都使用 TypeScript，幾乎無 `any` 濫用
- `@eshop/shared` 提供完整的型別定義， crawler 和 web 都有使用
- `as const` 和 literal types 使用恰當（如 `BATCH_SIZE`、`VALID_STATUSES`）

### ✅ 錯誤處理機制完善
- **Crawler**：price-api 有 retry + 指數退避 + 4xx 不重試策略
- **Web**：`fetchJsonWithFallback` 優雅降級（404 返回空資料）
- **Persister**：原子寫入（tmp + rename）、idempotent delta append、corrupted file fallback

### ✅ 測試品質高
- **Crawler 測試覆蓋率高**：price-api、opencritic、game-catalog、delta、persister、fetcher 都有完整測試
- **邊界測試完整**：空陣列、null、corrupted JSON、malformed HTML
- **Mock 策略正確**：`vi.mock('ofetch')` 模擬外部依賴
- **Web 測試**：GameCard、preferences store、useLocalStorage 都有覆蓋

### ✅ UI/UX 細節
- **RWD 完整**：mobile ≤767px、tablet ≤1023px、desktop ≥768px 三段式佈局
- **Loading 狀態**：骨架屏（GameSkeleton）提升感知效能
- **Error 狀態**：RetryButton + 清楚的錯誤訊息
- **無障礙**：`aria-label`、`aria-live`、`role="radiogroup"`、`focus-visible` 樣式
- **`prefers-reduced-motion`**：尊重使用者動畫偏好

### ✅ 效能考量
- **批量處理**：price-api 的 `BATCH_SIZE = 50` + rate limiting
- **快取策略**：OpenCritic 先用 top list（1 API call），再 search 剩餘
- **圖片懶載入**：`loading="lazy"` + SVG fallback
- **Debounce 搜尋**：300ms debounce 避免頻繁 filter

### ✅ 安全意識
- **API Key 環境變數化**：`OPENCRITIC_API_KEY` 從 env 讀取
- **Atomic write**：避免 race condition 導致資料損壞
- **Idempotent delta**：避免重複執行時產生重複記錄

### ✅ 代碼品質
- **命名一致**：camelCase for JS, kebab-case for CSS classes
- **BEM 命名**：`.game-card__title`、`.filter-bar__search`
- **Constant 提取**：`BATCH_SIZE`、`RETRY_ATTEMPTS`、`TIMEOUT_MS` 等魔法數字都有命名
- **JSDoc 註解**：重要函式都有文件說明

---

## 📋 細項清單

| # | 嚴重度 | 檔案 | 行號 | 問題摘要 |
|---|--------|------|------|----------|
| R1 | 🔴 嚴重 | `web/src/components/GameCard.vue` | ~55 | 圖片 onerror 直接操作 DOM，有 XSS 潛在風險 |
| R2 | 🔴 嚴重 | `crawler/src/adapters/game-catalog.ts` | 全文 | cheerio HTML 解析未做 input sanitization |
| R3 | 🔴 嚴重 | `crawler/src/services/fetcher.ts` | ~19 | fetchCatalog 無錯誤處理，異常直接 crash |
| R4 | 🔴 嚴重 | `web/src/services/data-loader.ts` | ~56 | fetchJsonWithFallback 安靜吞掉所有錯誤 |
| R5 | 🔴 嚴重 | `crawler/src/services/persister.ts` | ~134 | 原子寫入失敗時不保留原檔案 |
| Y1 | 🟡 建議 | `web/src/types/index.ts` | 全文 | 與 `packages/shared` 型別重複定義 |
| Y2 | 🟡 建議 | `web/src/stores/games.ts` | ~42 | hotGames/dealsGames 重複建立暫存物件 |
| Y3 | 🟡 建議 | `web/src/composables/useGamePage.ts` | ~18 | onMounted 缺少 error 狀態判斷 |
| Y4 | 🟡 建議 | `web/src/components/FilterBar.vue` | ~39 | debounce timer 未在 unmount 時清理 |
| Y5 | 🟡 建議 | `crawler/src/adapters/price-api.ts` + `opencritic.ts` | 多處 | sleep() helper 重複定義 |
| Y6 | 🟡 建議 | `crawler/src/services/delta.ts` | ~38 | 移除的遊戲未被追蹤（TODO 未實現） |
| Y7 | 🟡 建議 | `web/src/stores/games.ts` | ~17 | filteredGames 缺少 memoization |
| Y8 | 🟡 建議 | `web/src/__tests__/stores/` | — | 缺少 games store 測試 |
| Y9 | 🟡 建議 | `web/src/services/data-loader.ts` | ~46 | loadHistory 的 delta 轉換缺少預設值 |
| Y10 | 🟡 建議 | `web/src/__tests__/components/GameCard.test.ts` | ~35 | 使用文字比對斷言，不夠精確 |
| Y11 | 🟡 建議 | `crawler/src/adapters/opencritic.ts` | ~72 | 標題比對邏輯過於寬鬆 |
| Y12 | 🟡 建議 | `crawler/src/adapters/price-api.ts` | ~93 | getHttpStatus regex fallback 不精確 |

---

## 📝 總結

| 面向 | 評分 | 說明 |
|------|------|------|
| 架構設計 | 9/10 | 分層清晰、耦合度低、可擴展性佳 |
| 型別安全 | 8/10 | 幾乎無 any，但有重複定義問題 |
| 錯誤處理 | 7/10 | 大部分有處理，但有靜默失敗和 crash 風險 |
| 效能 | 8/10 | 批量處理 + debounce + lazy load，但有可優化空間 |
| 測試品質 | 8/10 | Crawler 測試完整，Web 端 games store 缺測試 |
| 安全性 | 7/10 | 有 XSS 潛在風險（DOM 操作 + HTML 解析） |
| 可維護性 | 8/10 | 命名一致、BEM 命名、常數提取，但有重複 code |

---

**Outcome: OK**
