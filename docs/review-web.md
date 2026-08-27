# Code Review Report — `web/`

**審查日期**：2026-08-08  
**審查範圍**：`/fork/YuHaoLiaoSideProject/Switch-eShopRadar/web/`  
**審查標準**：資深工程師

---

## 目錄

1. [總覽](#總覽)
2. [🔴 嚴重問題](#-嚴重問題)
3. [🟡 建議改进](#-建議改進)
4. [🟢 優點](#-優點)
5. [整體評分與總結](#整體評分與總結)

---

## 總覽

本專案是一個 Vue 3 + Pinia + Vue Router 的 Switch eShop 遊戲瀏覽器，使用 Vite 構建、Vitest 測試。整體架構清晰、型別使用良好、a11y 意識高，但存在若干效能、重構、以及潛在 bug 的問題。

---

## 🔴 嚴重問題

### R1. `useLocalStorage` 未在元件卸載時移除事件監聽 — 記憶體洩漏

**檔案**：`web/src/composables/useLocalStorage.ts` 第 35-37 行

```ts
if (typeof window !== 'undefined') {
  window.addEventListener('storage', onStorageChange);
}
```

每次呼叫 `useLocalStorage` 都會在 `window` 上註冊一個 `storage` 事件監聽器，但從未呼叫 `removeEventListener`。在 SPA 中如果 composable 被多次建立/銷毀（例如路由切換），會造成：
- 記憶體洩漏
- 多個重複的 listener 對同一個 key 作出反應
- 離開頁面後仍持續執行回調

**建議**：使用 `onUnmounted` 回調移除監聽器：

```ts
import { onUnmounted } from 'vue';

// 在 return 前
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', onStorageChange);
  }
});
```

---

### R2. 三個 Page 元件存在大量重複的 toggle 邏輯（DRY 違規）

**檔案**：
- `web/src/views/HotPage.vue` 第 25-37 行
- `web/src/views/DealsPage.vue` 第 25-37 行
- `web/src/views/NewReleasesPage.vue` 第 25-37 行

三個頁面完全重複了以下邏輯：

```ts
function handleToggleIgnore(gameId: string) {
  if (prefsStore.isIgnored(gameId)) {
    prefsStore.removeFromIgnoreList(gameId);
  } else {
    prefsStore.addToIgnoreList(gameId);
  }
}

function handleToggleWishlist(gameId: string) {
  if (prefsStore.isWishlisted(gameId)) {
    prefsStore.removeFromWishlist(gameId);
  } else {
    prefsStore.addToWishlist(gameId);
  }
}
```

加上 `onMounted` 的 fetch 邏輯、`isEmpty` 計算、`handleRetry` 等，**每個頁面有 ~60% 的 script 是完全重複的**。

**建議**：抽取 `useGamePage(computedRef)` composable：

```ts
// composables/useGamePage.ts
export function useGamePage(getGames: () => Game[]) {
  const gamesStore = useGamesStore();
  const prefsStore = usePreferencesStore();

  const games = computed(getGames);
  const isEmpty = computed(() => !gamesStore.loading && !gamesStore.error && games.value.length === 0);

  onMounted(() => {
    if (gamesStore.games.length === 0) gamesStore.fetchGames();
  });

  function handleRetry() { gamesStore.fetchGames(); }
  function handleToggleIgnore(gameId: string) {
    prefsStore.isIgnored(gameId)
      ? prefsStore.removeFromIgnoreList(gameId)
      : prefsStore.addToIgnoreList(gameId);
  }
  function handleToggleWishlist(gameId: string) {
    prefsStore.isWishlisted(gameId)
      ? prefsStore.removeFromWishlist(gameId)
      : prefsStore.addToWishlist(gameId);
  }

  return { gamesStore, games, isEmpty, handleRetry, handleToggleIgnore, handleToggleWishlist };
}
```

---

### R3. `GameList.vue` 獨立使用 FilterBar 但未被任何路由引用 — 死 Code

**檔案**：`web/src/components/GameList.vue`

此元件包含了 `FilterBar` + `GameGrid` + `GameCard` 的完整列表邏輯，但在 `router/index.ts` 中的三個路由分別使用了 `HotPage`、`DealsPage`、`NewReleasesPage`，這些頁面都沒有引用 `GameList`。

**結果**：`GameList.vue` 是一個未被使用的死元件，增加了維護成本和 bundle 大小。

**建議**：如果 FilterBar 功能是未來規劃，應在 README 標記；如果不需要，應移除此檔案。若要整合，應讓 FilterBar 在三個頁面上生效（目前只有 GameList 引用了 FilterBar，但三個 Page 都沒有用它）。

---

### R4. `GameCard.vue` 圖片 fallback 使用第三方 URL — 安全 & 可用性風險

**檔案**：`web/src/components/GameCard.vue` 第 57 行

```html
@error="($event.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400?text=No+Cover'"
```

問題：
1. **安全性**：引用外部 URL 可能被 XSS 利用（雖然此處是 img src 而非 script 注入，但仍有隱私洩漏 — 瀏覽器會向 via.placeholder.com 發送 referrer）
2. **可用性**：依賴第三方服務；如果 via.placeholder.com 宕機或改變策略，fallback 也會失敗
3. **效能**：error 觸發後又發起新的網路請求

**建議**：使用內建的 SVG data URI 或本地 fallback 圖片：

```html
@error="($event.target as HTMLImageElement).src = 'data:image/svg+xml,...'"
```

---

### R5. `games.ts` store 中 `hotGames` 和 `dealsGames` 的 `getDiscountPercent` 被重複計算 — 效能問題

**檔案**：`web/src/stores/games.ts` 第 46-75 行

```ts
const hotGames = computed(() => {
  return [...games.value]
    .map((g) => ({
      ...g,
      discountPercent: getDiscountPercent(g.id),  // 每個 game 都呼叫
    }))
    .sort(...)
    .slice(0, 20);
});

const dealsGames = computed(() => {
  return [...games.value]
    .filter((g) => getDiscountPercent(g.id) > 0)  // 每個 game 都呼叫
    .map((g) => ({
      ...g,
      discountPercent: getDiscountPercent(g.id),   // 又呼叫一次
    }))
    .sort(...);
});
```

`getDiscountPercent` 在 `dealsGames` 中對每個 game 被呼叫了 **兩次**（一次 filter、一次 map）。此外 `hotGames` 中 `sort` 前的 `.map()` 產生了不必要的中間物件展開。

**建議**：

```ts
const dealsGames = computed(() => {
  return games.value
    .map((g) => ({ ...g, discountPercent: getDiscountPercent(g.id) }))
    .filter((g) => g.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent);
});
```

或者更根本地，將 `discountPercent` 計算提取為 `computed` 的 Map 或在 `filteredGames` 的 sort 中使用 memoization。

---

### R6. `GameCard.vue` 中 `getDiscountPercent()` 在模板中反覆呼叫 — 無 memoization

**檔案**：web/src/components/GameCard.vue 第 40-44 行

```ts
function getDiscountPercent(): number {
  if (!props.price?.discountPrice || !props.price.regularPrice) return 0;
  return Math.round(...);
}
```

此函數在模板中被呼叫 **3 次**（v-if 判斷、折扣 badge 內容、original-price 的 v-if）。每次 re-render 都會重新計算。

**建議**：改為 `computed`：

```ts
const discountPercent = computed(() => {
  if (!props.price?.discountPrice || !props.price.regularPrice) return 0;
  return Math.round(
    ((props.price.regularPrice - props.price.discountPrice) / props.price.regularPrice) * 100
  );
});
```

---

## 🟡 建議改進

### Y1. Router 使用 Hash 模式 — 可能非最佳選擇

**檔案**：`web/src/router/index.ts` 第 18 行

```ts
history: createWebHashHistory(),
```

Hash 模式（`/#/hot`）在現代 SPA 中已不推薦，除非有特殊部署需求（如 GitHub Pages 不支援 SPA routing）。

**建議**：若部署環境支援（如 Nginx 配置 try_files），應改用 `createWebHistory()`，產生更乾淨的 URL。

---

### Y2. 三個 Page 元件的 `onMounted` 使用 `gamesStore.games.length === 0` 判斷 — Race Condition

**檔案**：`HotPage.vue` / `DealsPage.vue` / `NewReleasesPage.vue` 第 19-21 行

```ts
onMounted(() => {
  if (gamesStore.games.length === 0) {
    gamesStore.fetchGames();
  }
});
```

如果使用者快速在三個路由間切換，可能出現：
- 第一次 mount 開始 fetch（loading = true）
- 用戶切到另一頁，第二個 mount 發現 `games.length === 0`（尚未完成），也開始 fetch
- 兩個 fetch 同時執行

**建議**：在 store 中使用 loading 狀態防護：

```ts
onMounted(() => {
  if (!gamesStore.loading && gamesStore.games.length === 0) {
    gamesStore.fetchGames();
  }
});
```

---

### Y3. `data-loader.ts` 缺少 fetch 超時與重試機制

**檔案**：`web/src/services/data-loader.ts`

三個 fetch 函數都沒有：
- **超時設定**：如果伺服器無回應，會永遠 hang
- **重試機制**：網路閃斷時無法自動恢復
- **AbortController**：路由切換時無法取消過期的請求

**建議**：至少加入 `AbortController` + `timeout`：

```ts
export async function loadGames(signal?: AbortSignal): Promise<Game[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${BASE_DATA_URL}/games.json`, {
      signal: signal ?? controller.signal,
    });
    if (!response.ok) throw new Error(`Failed to load games: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### Y4. `GameSkeleton.vue` 在 `<script setup>` 中無程式碼 — 不需要 script 標籤

**檔案**：`web/src/components/GameSkeleton.vue`

此元件只有 `<template>` 和 `<style>`，沒有 `<script setup>` 標籤，這是正確的。但注意到 `role="status"` 和 `aria-live="polite"` 在 skeleton 上可能不是最佳做法 — skeleton 是視覺提示，不是動態更新區域。

**建議**：skeleton 可考慮使用 `aria-hidden="true"` 而非 `aria-live="polite"`，避免螢幕閱讀器在載入時不斷朗讀。實際上已經有 `aria-hidden="true"`，但同時有 `role="status"` + `aria-live="polite"`，這是矛盾的。

---

### Y5. `FilterBar.vue` 的搜尋輸入缺少 debounce

**檔案**：`web/src/components/FilterBar.vue` 第 34 行

```html
@input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
```

每次輸入一個字元都會立即更新 store 的 `searchQuery`，觸發 `filteredGames` computed 重新計算（包含 filter + sort）。在遊戲列表較大時可能造成效能問題。

**建議**：加入 debounce（300ms）：

```ts
import { useDebounceFn } from '@vueuse/core'; // 或自建

const debouncedEmit = useDebounceFn((val: string) => {
  emit('update:searchQuery', val);
}, 300);
```

---

### Y6. `GameCard.vue` 的 `alt` 文本直接使用 `game.title` — 可能過長

**檔案**：`web/src/components/GameCard.vue` 第 55 行

```html
<img :src="game.coverUrl" :alt="game.title" loading="lazy" ... />
```

某些遊戲標題可能非常長（含副標題），對螢幕閱讀器使用者來說可能太冗長。

**建議**：標題已經在 `<h3>` 中顯示，img 的 alt 可以簡化為 `cover image` 或 `game cover`：

```html
<img :src="game.coverUrl" :alt="`${game.title} cover`" ... />
```

---

### Y7. `preferences.ts` store 的 `addToIgnoreList` / `addToWishlist` 使用 spread 複製 — 效能

**檔案**：`web/src/stores/preferences.ts` 第 22-28 行

```ts
function addToIgnoreList(gameId: string) {
  if (!stored.value.ignoreList.includes(gameId)) {
    stored.value = {
      ...stored.value,
      ignoreList: [...stored.value.ignoreList, gameId],
    };
  }
}
```

每次新增都做 spread 複製，且 `stored.value` 是 `ref`，賦值新物件會觸發 `useLocalStorage` 的 deep watcher。如果 ignoreList 很大（幾百個），效能會下降。

**建議**：直接 mutate（Pinia ref 支持直接 mutate array）：

```ts
function addToIgnoreList(gameId: string) {
  if (!stored.value.ignoreList.includes(gameId)) {
    stored.value.ignoreList.push(gameId);
  }
}
```

但需確認 `useLocalStorage` 的 watcher 能偵測到 array mutation（deep: true 應該可以）。

---

### Y8. `GameGrid.vue` 的 loading skeleton 固定顯示 8 個 — 不符合實際佈局

**檔案**：`web/src/components/GameGrid.vue` 第 8 行

```html
<GameSkeleton v-for="n in 8" :key="n" />
```

固定的 8 個 skeleton 在不同螢幕尺寸下佈局不同（mobile 2 欄、desktop 4+ 欄），視覺效果可能不協調。

**建議**：根據實際 grid columns 動態計算，或使用 CSS 隱藏多餘的 skeleton。

---

### Y9. `HotPage.vue` / `DealsPage.vue` / `NewReleasesPage.vue` 未套用 FilterBar

**檔案**：三個 Page 元件

`GameList.vue` 中有 `FilterBar`，但三個頁面都沒有使用 `FilterBar`。這意味著：
- 熱門頁面無法搜尋/篩選
- 折扣頁面無法搜尋/篩選
- 新發售頁面無法搜尋/篩選

**建議**：確認這是否為有意設計。如果所有頁面都應該支援搜尋/篩選，應將 FilterBar 整合進各頁面或使用 composable。

---

### Y10. `types/index.ts` 中 `GameWithPrice` 未被使用

**檔案**：`web/src/types/index.ts` 第 30-33 行

```ts
export interface GameWithPrice extends Game {
  price: PriceRecord | null;
}
```

搜尋所有檔案，此型別未被任何地方引用。

**建議**：移除或在未來使用時再加入。

---

### Y11. `RetryButton.vue` 接受 `loading` prop 但 `GameGrid` 未傳遞

**檔案**：`web/src/components/RetryButton.vue` 第 3 行  
`web/src/components/GameGrid.vue` 第 19 行

```html
<RetryButton @retry="$emit('retry')" />
```

`RetryButton` 定義了 `loading` prop，但 `GameGrid` 在使用時沒有傳入 `loading`，導致 RetryButton 永遠不會進入 disabled 狀態（無法防止重複點擊）。

**建議**：在 `GameGrid` 中將 `loading` 傳給 `RetryButton`：

```html
<RetryButton :loading="loading" @retry="$emit('retry')" />
```

---

### Y12. `PillFilter.vue` 的 `handleKeydown` 中 `pillRefs` 未使用

**檔案**：`web/src/components/PillFilter.vue` 第 42 行

```html
<button v-for="option in options" ref="pillRefs" ...>
```

`pillRefs` 被綁定但從未在 script 中引用（`handleKeydown` 只透過 index 操作，不需 refs）。

**建議**：移除 `ref="pillRefs"` 以保持程式碼整潔。

---

### Y13. `App.vue` 缺少 `<meta>` 描述與 SEO 設定

**檔案**：`web/index.html`

```html
<title>Switch eShop Radar</title>
```

缺少：
- `<meta name="description" content="...">`
- Open Graph 標籤（社交分享）
- favicon 僅使用 `.ico`，缺少多尺寸支援

**建議**：加入基本 SEO 標籤。

---

### Y14. `GameCard.vue` 缺少 `v-memo` 或 `shallowRef` 優化 — 大列表效能

**檔案**：`web/src/components/GameCard.vue`

當遊戲列表有數百個時，每個 `GameCard` 都是獨立的元件實例。目前沒有使用 `v-memo`、`shallowRef`、或虛擬滾動來優化。

**建議**：對於 100+ 項目的列表，應考慮：
- `vue-virtual-scroller` 或 `@tanstack/vue-virtual` 虛擬滾動
- 或至少在父層使用 `v-memo` 減少不必要的 re-render

---

## 🟢 優點

### G1. 路由懶載入 ✅

**檔案**：`web/src/router/index.ts`

三個頁面都使用動態 import 實現路由懶載入，有效減小初始 bundle 大小。

### G2. a11y 意識良好 ✅

- `PillFilter` 實作了完整的 `role="radiogroup"` + `role="radio"` + `aria-checked` + `tabindex` roving tabindex 模式
- `GameCard` 的按鈕有明確的 `aria-label`（「加入願望清單」/「移除願望清單」/「忽略此遊戲」/「取消忽略」）
- `GameGrid` 的 loading/error 狀態使用 `role="status"` / `role="alert"` + `aria-live`
- 所有 icon 元件都帶有 `aria-hidden="true"`
- `FilterBar` 的搜尋有 `<label>` 配合 `sr-only` class
- `RetryButton` 支援 `prefers-reduced-motion` 媒體查詢

### G3. CSS 變數系統一致 ✅

使用 CSS 自訂屬性（`--gap-sm`、`--fs`、`--accent`、`--radius` 等）建立了一致的設計語言，易於維護和主題切換。

### G4. RWD 斷點處理完整 ✅

三個斷點（mobile ≤767px、tablet ≤1023px、desktop）在 `App.vue`、`GameCard.vue`、`FilterBar.vue`、`GameGrid.vue`、`PillFilter.vue` 都有一致的響應式處理。特別是 `GameCard` 在 mobile 切換為水平佈局是很好的 UX 設計。

### G5. 型別安全 ✅

- TypeScript strict mode 啟用
- 所有 props 都有明確的 interface 定義
- `defineEmits` 使用型別化的事件定義
- 沒有 `any` 的使用
- `Game`、`PriceRecord`、`Platform` 等型別定義清晰

### G6. 深色/淺色主題支援（via CSS 變數） ✅

透過 `var(--text)`、`var(--surface)`、`var(--border)` 等變數，為主題切換預留了基礎。

### G7. Pinia store 設計清晰 ✅

- `games.ts` 使用 Composition API style（`defineStore` with setup function）
- 狀態與 actions 分離清晰
- `filteredGames`、`hotGames`、`dealsGames`、`newReleases` 用 computed 派生，避免手動管理
- `preferences.ts` 透過 `useLocalStorage` composable 實現持久化

### G8. 測試覆蓋良好 ✅

- `GameCard.test.ts`：12 個測試案例，覆蓋了渲染、事件發送、條件渲染、樣式等
- `useLocalStorage.test.ts`：9 個測試案例，覆蓋了讀寫、序列化、跨 tab 同步、損壞資料處理
- `preferences.test.ts`：13 個測試案例，覆蓋了 CRUD、去重、計數、localStorage 持久化、損壞資料處理

### G9. 圖片使用 `loading="lazy"` ✅

**檔案**：`web/src/components/GameCard.vue` 第 54 行

原生 lazy loading 有效減少初始載入時間。

### G10. `useLocalStorage` 的跨 tab 同步 ✅

**檔案**：`web/src/composables/useLocalStorage.ts` 第 30-35 行

透過 `StorageEvent` 實現了多分頁同步，是一個加分項。

---

## 整體評分與總結

| 維度 | 評分 (1-10) | 說明 |
|------|:-----------:|------|
| 元件架構 | 7 | 基本拆分合理，但 Page 元件重複度高；GameList 是死 Code |
| 狀態管理 | 8 | Pinia 使用得當，computed 派生清晰；但 spread 操作可優化 |
| 路由設計 | 8 | 懶載入良好；Hash 模式可改 |
| 效能 | 6 | 缺少 debounce、虛擬滾動、重複計算；大列表場景堪慮 |
| 可及性 (a11y) | 9 | PillFilter roving tabindex、ARIA 標籤、keyboard navigation 都到位 |
| 響應式設計 | 9 | 三斷點一致、mobile 佈局切換合理 |
| 型別安全 | 9 | strict mode、無 any、props 皆有型別 |
| 測試品質 | 7 | 覆蓋了核心元件和 composable；缺少 router、data-loader、GameGrid 測試 |
| 安全性 | 7 | 無明顯 XSS 風險；外部 placeholder URL 有隱私疑慮 |
| 使用者體驗 | 8 | 載入/錯誤/空狀態都有處理；但缺少骨架屏優化和搜尋 debounce |

### **整體評分：7.8 / 10**

### 總結

本專案在 **a11y、RWD、型別安全、Pinia 架構** 方面表現優異，展現了資深前端工程師的意識。主要短板集中在：

1. **效能**：缺少 debounce、虛擬滾動、computed 重複計算
2. **重構**：三個 Page 元件 ~60% 邏輯重複，應抽取 composable
3. **死 Code**：`GameList.vue` 未被引用，`GameWithPrice` 未被使用
4. **可靠性**：`useLocalStorage` 記憶體洩漏、fetch 無超時、RetryButton 缺 loading 傳遞

建議優先修復 🔴 嚴重問題（尤其是 R1 記憶體洩漏和 R2 重複邏輯），然後處理 🟡 建議改進中的效能相關項目。

---

*Report generated by Code Review Agent*
