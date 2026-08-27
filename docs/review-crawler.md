# Code Review Report — `crawler/`

**審查範圍：** `crawler/src/` 全部模組  
**審查日期：** 2025-07-25  
**審查標準：** 資深工程師 Code Review

---

## 📊 整體評分：6.5 / 10

**總結：** 架構分層清晰、測試覆蓋完善、型別安全度高。主要問題集中在 **程式碼重複**（兩個 `fetchPriceBatch` 實作）、**index.ts 未串接**、以及部分 **錯誤處理的脆弱性**。建議修復 🔴 嚴重問題後，整體品質可提升至 8 分以上。

---

## 🔴 嚴重問題（Must Fix）

### 1. `fetchPriceBatch` 重複實作 — 雙重維護風險

**檔案：** `src/services/fetcher.ts:40-70` + `src/adapters/price-api.ts:95-126`

`fetchPriceBatch` 同時在 `fetcher.ts` 和 `price-api.ts` 中實作，兩者邏輯相似但不完全相同：

| 差異點 | fetcher.ts | price-api.ts |
|--------|-----------|--------------|
| retries 參數 | `options.retries` (可選, 預設 3) | `RETRY_ATTEMPTS` (常數 3) |
| URL 建構 | 內建 | 呼叫端建構 |
| 4xx 判斷 | `includes('400') && !includes('429')` | `includes('4004') \|\| includes('400')` (無 429 例外!) |

**風險：** 修正一邊的 bug 另一邊不會自動修正，且 4xx 判斷邏輯不一致。

**建議：** 刪除 `fetcher.ts` 中的 `fetchPriceBatch`，統一使用 `price-api.ts` 的實作。Fetcher 只負責組合 URL + 呼叫 adapter。

---

### 2. `index.ts` 完全未串接 — 入口是空殼

**檔案：** `src/index.ts:1-8`

```typescript
async function main(): Promise<void> {
  // TODO: wire up adapters → fetch → computeDelta → write JSON
  console.log('[crawler] main() — not yet implemented');
}
```

整條 pipeline（fetch → delta → persist）無法從 CLI 啟動。這不是「建議」而是功能缺失。

**建議：** 實作 `main()` 串接 `runFetch` → `computeDelta` → `writeLatest` / `appendDelta`，並從環境變數或 config 讀取 URL / dataDir。

---

### 3. 4xx 錯誤判斷使用字串匹配 — 脆弱且不一致

**檔案：** `src/services/fetcher.ts:56-59`

```typescript
const msg = lastError.message.toLowerCase();
if ((msg.includes('400') || msg.includes('4004')) && !msg.includes('429')) {
  throw lastError;
}
```

問題：
- `includes('400')` 會匹配 `4000`、`4004`、`4009` 等非 400 狀態碼
- `!includes('429')` 假設 error message 包含狀態碼字串，這取決於 ofetch 的實作
- `price-api.ts:118-120` 的判斷邏輯完全不同（無 429 例外）

**建議：** 使用 ofetch 回傳的 HTTP 狀態碼（`err.response?.status`）而非字串匹配。例如：
```typescript
if (err instanceof FetchError && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
  throw err;
}
```

---

### 4. `appendDelta` 非原子操作 — 併發寫入風險

**檔案：** `src/services/persister.ts:56-78`

```typescript
const content = fs.readFileSync(filePath, 'utf-8');  // read
existing = JSON.parse(content) as PriceDelta[];
existing.push(delta);                                  // modify
fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');  // write
```

若兩個 process 同時執行（例如 cron 重疊、CI 並行），可能造成資料遺失。

**建議：** 
- 短期：寫入 tmp 檔後 rename（atomic on most filesystems）
- 長期：考慮 SQLite 或 append-only 的 JSONL 格式

---

### 5. `parsePriceEntry` 使用 `as` 型別斷言 — 無驗證

**檔案：** `src/adapters/price-api.ts:80`

```typescript
salesStatus: entry.sales_status as PriceRecord['salesStatus'],
```

若 API 回傳未知的 `sales_status` 值，會靜默通過無型別安全的值。

**建議：** 加入型別守衛：
```typescript
const VALID_STATUSES = ['onsale', 'preorder', 'unreleased', 'not_found'] as const;
const salesStatus = VALID_STATUSES.includes(entry.sales_status as any)
  ? entry.sales_status as PriceRecord['salesStatus']
  : 'not_found';
```

---

## 🟡 建議改進（Should Fix）

### 6. `runFetch` 中 `chunks.indexOf(chunk)` 效率低

**檔案：** `src/services/fetcher.ts:100`

```typescript
if (chunks.indexOf(chunk) < chunks.length - 1) {
```

每次迴圈都做 O(n) 查找。應改為 `for` 迴圈或 `forEach` 搭配 index。

**建議：**
```typescript
for (let i = 0; i < chunks.length; i++) {
  const prices = await fetchPriceBatch(chunks[i], priceApiBaseUrl, { country, lang });
  allPrices.push(...prices);
  if (i < chunks.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
```

---

### 7. `isSamePrice` 未比較 `currency`

**檔案：** `src/services/delta.ts:50-62`

`pickFields` 包含 `currency`，但 `isSamePrice` 不比較它。雖然 currency 實務上不太會變動，但邏輯上不一致。

**建議：** 加入 `a.currency === b.currency` 到 `isSamePrice`。

---

### 8. `readLatest` 靜默吞掉所有錯誤

**檔案：** `src/services/persister.ts:37-44`

```typescript
} catch {
  return null;
}
```

任何錯誤（權限不足、磁碟滿、非 JSON 格式）都回傳 null，可能隱藏問題。

**建議：** 至少在 catch 中 `console.warn`，或區分「檔案不存在」與「讀取失敗」。

---

### 9. `fetchCatalog` 無 retry 機制

**檔案：** `src/services/fetcher.ts:33-35`

```typescript
export async function fetchCatalog(url: string): Promise<ParsedCatalogEntry[]> {
  const html = await ofetch<string>(url, { responseType: 'text' });
  return parseNintendoTWCatalogHtml(html);
}
```

Catalog fetch 是單次網路請求，失敗即中斷整條 pipeline。Price fetch 有 retry，catalog 卻沒有。

**建議：** 加入與 price fetch 一致的 retry 邏輯，或抽出共用的 `withRetry` 工具函數。

---

### 10. `NintendoTWCatalog` class 未被使用

**檔案：** `src/adapters/game-catalog.ts:73-84`

```typescript
export class NintendoTWCatalog implements GameCatalogAdapter {
  async fetchCatalog(_platform): Promise<Game[]> {
    throw new Error('Use parseNintendoTWCatalogHtml ...');
  }
}
```

這個 class 佔用空間卻不被任何地方引用，且 `fetchCatalog` 方法直接 throw。

**建議：** 要麼刪除這個 class（保留 `parseNintendoTWCatalogHtml` 即可），要麼讓它真正實作 fetch + parse 的完整流程。

---

### 11. 缺少環境變數 / config 管理

**檔案：** `src/services/fetcher.ts:1-10`

`FetcherConfig` 的 URL 和 country/lang 都是函數參數，無從環境變數讀取的機制。

**建議：** 加入 `process.env` 讀取或使用 `dotenv`，讓部署更靈活：
```typescript
const config: FetcherConfig = {
  catalogUrl: process.env.CATALOG_URL ?? 'https://www.nintendo.com/tw/software/switch',
  priceApiBaseUrl: process.env.PRICE_API_URL ?? 'https://api.ec.nintendo.com/v1/price',
  country: process.env.COUNTRY ?? 'TW',
  lang: process.env.LANG ?? 'zh',
};
```

---

### 12. 缺少共用的 retry 工具

**檔案：** `src/services/fetcher.ts` + `src/adapters/price-api.ts`

兩個模組各自實作 retry + backoff，邏輯重複且不一致。

**建議：** 抽出 `src/utils/retry.ts`：
```typescript
export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; delayMs?: number; retryOn?: (err: Error) => boolean }): Promise<T>
```

---

### 13. 部分測試的 mock 策略可改善

**檔案：** `src/services/__tests__/fetcher.test.ts:8-10`

```typescript
const mockOfetch = vi.fn();
vi.mock('ofetch', () => ({
  ofetch: (...args: unknown[]) => mockOfetch(...args),
}));
```

使用 module-level `vi.fn()` + `vi.mock` 是可行的，但 `mockOfetch` 在多個 describe 區塊間共享同一實例，若 `beforeEach` 的 `mockReset()` 遺漏可能導致測試間洩漏。

**建議：** 確認每個 `describe` 區塊都有獨立的 `beforeEach(() => mockOfetch.mockReset())`（目前已做），或改用 `vi.spyOn` + `mockImplementation` 搭配 `afterEach`。

---

## 🟢 優點（Good Things）

### ✅ 清晰的架構分層
`adapters/`（外部 API 解析）→ `services/`（業務邏輯）→ `index.ts`（組裝）的分層非常乾淨，依賴方向單向，易於測試與替換。

### ✅ HTML 解析的多策略容錯
`game-catalog.ts:parseNintendoTWCatalogHtml` 使用三種策略（href → class/data-attribute → 全文掃描）循序嘗試提取 NSUID，且有去重機制。這是面對不穩定 HTML 的正確做法。

### ✅ Delta 計算的 idempotent 設計
`delta.ts` 與 `persister.ts` 都確保同一天的 delta 不會重複寫入，這對 cron 排程非常重要。

### ✅ 完善的邊界測試
`price-api.test.ts` 測試了 not_found、preorder、unreleased、折扣等於原價等邊界情境；`persister.test.ts` 測試了損壞 JSON、目錄建立、重複寫入等。測試品質明顯高於平均水平。

### ✅ 型別安全度高
幾乎無 `any` 濫用，所有外部 API 回應都有對應的 interface 定義（`NintendoPriceApiResponse`、`NintendoPriceEntry`），解析後轉為內部型別。

### ✅ Rate Limiting 與 Exponential Backoff
Price API 的批次請求有 200ms 間隔，retry 有 exponential backoff，不會打垮第三方 API。

### ✅ Vitest 設定合理
`vitest.config.ts` 排除了 `__tests__` 和 `index.ts` 的 coverage，include 設定精確。

---

## 📋 細項清單

| # | 嚴重度 | 檔案 | 行號 | 問題摘要 |
|---|--------|------|------|---------|
| 1 | 🔴 | fetcher.ts + price-api.ts | 40-70 / 95-126 | `fetchPriceBatch` 重複實作 |
| 2 | 🔴 | index.ts | 1-8 | 入口未串接，功能缺失 |
| 3 | 🔴 | fetcher.ts | 56-59 | 4xx 判斷用字串匹配，脆弱且不一致 |
| 4 | 🔴 | persister.ts | 56-78 | 非原子讀寫，併發風險 |
| 5 | 🔴 | price-api.ts | 80 | `as` 型別斷言無驗證 |
| 6 | 🟡 | fetcher.ts | 100 | `indexOf` 效率低 |
| 7 | 🟡 | delta.ts | 50-62 | 未比較 currency |
| 8 | 🟡 | persister.ts | 37-44 | 靜默吞錯誤 |
| 9 | 🟡 | fetcher.ts | 33-35 | catalog fetch 無 retry |
| 10 | 🟡 | game-catalog.ts | 73-84 | 未使用的 class |
| 11 | 🟡 | fetcher.ts | — | 缺少 env config |
| 12 | 🟡 | fetcher.ts + price-api.ts | — | 缺少共用 retry 工具 |
| 13 | 🟡 | fetcher.test.ts | 8-10 | mock 共享實例風險 |

---

## 🎯 建議修復優先順序

1. **合併 `fetchPriceBatch`** → 消除重複，統一 retry 邏輯
2. **實作 `index.ts`** → 讓 crawler 可以實際運行
3. **用 HTTP status code 替代字串匹配** → 提升錯誤處理可靠性
4. **加入 atomic write** → 防止併發資料損壞
5. **其餘 🟡 問題** → 逐步改善

---

*Review generated at 2025-07-25 by senior engineer code review standard.*
