# Code Review: `@eshop/shared`

> 審查日期：2025-08  
> 審查範圍：`packages/shared/` 全部檔案 + `web/src/types/index.ts` 交叉比對  
> 審查標準：資深工程師 Code Review

---

## 審查清單

| 檔案 | 狀態 |
|---|---|
| `packages/shared/src/index.ts` | ✅ 已審查 |
| `packages/shared/src/__tests__/shared.test.ts` | ✅ 已審查 |
| `packages/shared/package.json` | ✅ 已審查 |
| `packages/shared/tsconfig.json` | ✅ 已審查 |
| `web/src/types/index.ts`（交叉比對） | ✅ 已審查 |
| `crawler/src/**` 使用端（交叉比對） | ✅ 已審查 |

---

## 🟢 優點

### 1. 乾淨的型別導出設計
`packages/shared/src/index.ts` — 純型別檔案，無運行時副作用，作為 monorepo 共享型別的定位精準。

### 2. 測試策略合理
`shared.test.ts` 使用 `expectTypeOf` 驗證型別結構 + 程式碼實例驗證可賦值性，兼顧型別安全與可讀性。

### 3. `package.json` exports 設計正確
使用 `"types"` + `"import"` 雙欄位，符合 ESM + TypeScript 最佳實踐。`"main"` 指向 `.ts` 源碼對 monorepo 內部使用合理。

### 4. 複合型別設計實用
`PriceSnapshot`、`PriceDelta`、`GameCatalog` 清晰表達了「快照 vs. 差異」的 domain model，與 crawler 的 `delta.ts`、`persister.ts` 使用場景高度吻合。

### 5. `PriceDelta.changes` 使用 `Partial<PriceRecord>` 
`from/to` 用 partial 合理地表達「只有變動的欄位」，避免冗餘。

---

## 🟡 建議（中優先級）

### Y-1. `web/src/types/index.ts` 與 `shared` 型別不一致（同步 debt）
**檔案：** `web/src/types/index.ts` vs `packages/shared/src/index.ts`

web 的 `PriceRecord.currency` 是 `string`，shared 是 `'TWD'`（字面型別）。  
web 的 `SalesStatus` 包含 `'unavailable'`，shared 是 `'not_found'`。  
web 缺少 `goldPoint`、`discountPercent` 欄位。

> **建議：** web 的 `types/index.ts` 第 1 行已寫「will be replaced once shared is fully established」—— 建議設立 ticket 追蹤此同步 debt，避免兩套型別長期並存造成隱性 bug。

### Y-2. `goldPoint` 型別不夠嚴謹
**檔案：** `packages/shared/src/index.ts`，第 25–28 行

```ts
goldPoint?: {
  basicGiftRate: string;
  basicGiftGp: string;
};
```

`basicGiftRate` 與 `basicGiftGp` 為 `string`，但從命名看應為數值（百分比 / GP 點數）。若 API 回傳 `"10%"` 或 `"500"` 都是 string 尚可，但若需運算則需 `number`。

> **建議：** 確認 API 原始回傳型別。若為數值，改 `number`；若為格式化字串，保留 `string` 但加 JSDoc 註解說明格式（如 `"10%"` 或 `"500"`）。

### Y-3. `PriceRecord.amount` 與 `regularPrice` 的關係未文件化
**檔案：** `packages/shared/src/index.ts`，第 16–18 行

`amount`（TWD raw_value）與 `regularPrice` 兩者都是 `number`，語義重疊。從 crawler 的使用推斷 `amount` 可能是當前售價、`regularPrice` 是原價，但型別本身沒有 JSDoc 說明。

> **建議：** 為每個欄位加 JSDoc，至少說明 `amount` 的業務含義（如 `/** 當前售價（TWD raw_value，如 179000 = NT$1790）*/`）。

### Y-4. 缺少 Zod / runtime validation 層
**檔案：** `packages/shared/src/index.ts`

純 TypeScript 介面在 runtime 無法驗證。crawler 從外部 API 取得 JSON 後直接賦值給 `PriceRecord`，若 API schema 變動會在下游才爆炸。

> **建議：** 長期考量加入 Zod schema（如 `PriceRecordSchema`），可同時作為型別來源與 runtime validation。短期至少在 crawler 的 adapter 層做 defensive parsing。

### Y-5. `PriceDelta.changes[].from` / `to` 用 `Partial<PriceRecord>` 會洩漏 id
**檔案：** `packages/shared/src/index.ts`，第 34–37 行

`Partial<PriceRecord>` 意味著 `id` 也是 optional，但 `id` 在 delta 語境下是必備的（你知道在追蹤哪個 game）。

> **建議：** 改用 Omit 重構：

```ts
changes: Array<{
  id: string;
  from: Partial<Omit<PriceRecord, 'id'>> & { id: string };
  to: Partial<Omit<PriceRecord, 'id'>> & { id: string };
}>;
```

或抽出 `PriceRecordFields = Omit<PriceRecord, 'id'>` 降低重複。

---

## 🔴 嚴重（高優先級）

### R-1. `package.json` 缺少 `files` 或 `.npmignore`，publish 會洩漏源碼
**檔案：** `packages/shared/package.json`

目前 `"main"` 指向 `./src/index.ts`，publish 時會把 `src/`、`__tests__/`、`tsconfig.json` 全部打包進去。雖然 monorepo 內部使用問題不大，但若未來 publish 到 npm registry，會洩漏測試碼與原始碼。

> **建議：** 加入 `"files": ["src/index.ts"]` 或更規範地加入 build step 輸出 `dist/`，將 `"main"` 改指向 `dist/index.js`、`"types"` 指向 `dist/index.d.ts`。

### R-2. `tsconfig.json` 缺少 `composite: true`
**檔案：** `packages/shared/tsconfig.json`

monorepo 使用 TypeScript project references 時，被引用的 package 需要 `"composite": true`。目前根 tsconfig 有 `declaration: true` 但 shared 子 package 沒有 `composite`，若 crawler 或 web 使用 project references 會 build 失敗。

> **建議：** 在 `compilerOptions` 加入 `"composite": true`。

### R-3. `Game.platform` 的 union 值 `'switch1' | 'switch2'` 與 Nintendo 官方命名不一致
**檔案：** `packages/shared/src/index.ts`，第 7 行

Nintendo 官方稱呼為 `Nintendo Switch` 和 `Nintendo Switch 2`。`switch1` / `switch2` 是內部自創命名。若未來 eShop API 回傳官方 platform identifier，會需要 mapping 層。

> **建議：** 至少在 JSDoc 註解說明這是內部識別碼（非 eShop API 原始值），並在 crawler adapter 層保留 mapping 邏輯的 TODO。

### R-4. 測試缺少 negative / error path 覆蓋
**檔案：** `packages/shared/src/__tests__/shared.test.ts`

目前 9 個 test case 全部是 happy path（正確型別賦值）。缺少：
- 缺少必填欄位時 TypeScript 是否報錯（`@ts-expect-error` 測試）
- `platform` 傳入非法值時的行為
- `salesStatus` 傳入非法值時的行為

> **建議：** 加入 `@ts-expect-error` 測試驗證型別收窄有效性：

```ts
it('should reject invalid platform value', () => {
  // @ts-expect-error — 'switch3' is not a valid platform
  const invalid: Game = { id: '1', title: 'x', platform: 'switch3', coverUrl: '', releaseDate: '' };
});
```

---

## 整體評分

| 維度 | 分數 (1-10) | 說明 |
|---|---|---|
| 型別設計 | 7 | 核心型別合理，但缺 JSDoc、`Partial` 洩漏 id、`goldPoint` 型別模糊 |
| API 契約 | 6 | 與 crawler 衔接良好，但與 web 有不同步的 debt |
| 可重用性 | 8 | 純型別、無副作用、命名清晰，通用性高 |
| 測試品質 | 5 | 只有 happy path，缺 negative path 和 `@ts-expect-error` |
| 向前兼容 | 6 | 無 `composite`、無 build step、無版本策略 |

### **綜合評分：6.5 / 10**

---

## 總結

`@eshop/shared` 作為 monorepo 的共享型別層，**核心方向正確**：純型別導出、乾淨的 domain model（Snapshot/Delta 模式）、合理的 package.json exports 設計。

主要風險集中在三個面向：
1. **型別精確度不足** — `Partial` 洩漏 `id`、`goldPoint` 用 `string` 模糊、缺 JSDoc
2. **工程基建缺漏** — 無 `composite`、無 build step、publish 會洩漏測試碼
3. **測試只覆蓋 happy path** — 缺少 `@ts-expect-error` 驗證型別邊界

建議優先修復 **R-1**（`files` 字段）和 **R-2**（`composite`），這是會直接影響 build 的阻塞問題。其餘 🟡 建議可列入 tech debt ticket 追蹤。

---

*Review generated: 2025-08*
