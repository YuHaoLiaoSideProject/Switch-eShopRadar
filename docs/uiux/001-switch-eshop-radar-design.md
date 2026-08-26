# Switch eShop Radar — UI/UX 設計文件

> 編號：001　｜　日期：2025-08-26　｜　狀態：Draft

---

## 1. 現況審計

| # | 問題 | 嚴重度 | 位置 |
|---|------|--------|------|
| 1 | 無深色主題（無 `[data-theme]` 切換） | P1 | `styles.css` |
| 2 | 無 RWD（無 `@media` queries） | P1 | 全元件 |
| 3 | GameCard 無 `:focus-visible` style（鍵盤導覽無視覺回饋） | P1 | `GameCard.vue` |
| 4 | FilterBar 使用原生 `<select>`（手機不友善、無自訂選項） | P2 | `FilterBar.vue` |
| 5 | Loading 只有文字「載入中...」，無 skeleton 動畫 | P2 | `GameList.vue` / 各 Page |
| 6 | Error 狀態僅顯示文字，無 retry 按鈕或 mechanism | P2 | `GameList.vue` / 各 Page |
| 7 | 圖示使用 emoji（🎮🔥💸🆕⭐🚫👁️🔍）— 跨平台渲染不一致 | P2 | `App.vue` / `GameCard.vue` |
| 8 | 無 `prefers-reduced-motion` 支援 | P3 | `styles.css` |
| 9 | 三頁（Hot/Deals/New）有重複 layout code，未抽取共用 layout | P3 | `views/*.vue` |
| 10 | 無 skeleton / shimmer loading 效果 | P3 | `GameList.vue` |

### 驗證方法

- 程式碼審查：確認無 `@media`、無 `data-theme`、無 `:focus-visible`
- 結構分析：三頁結構高度重複（loading/error/empty + grid）
- 語意化檢查：確認 emoji 使用位置

---

## 2. 設計原則

| # | 原則 | 說明 |
|---|------|------|
| 1 | **一致性** | 所有控制元件同高 36px（desktop）/ 44px（mobile），圓角 6px |
| 2 | **漸進式揭露** | 預設顯示核心資訊（封面 + 標題 + 價格），hover 展開次要動作（忽略/願望） |
| 3 | **Contextual 不佔位** | 折扣標籤只在有折扣時顯示，無折扣時不佔空間 |
| 4 | **語意化圖示** | 一律使用 inline SVG，附 aria-hidden，不用 emoji 當 icon |
| 5 | **觸控與鍵盤優先** | 所有互動元件 ≥44px 觸控區域（mobile），focus ring 清晰可見 |

---

## 3. Design Token 表

### 3.1 尺寸

| Token | 值 | 說明 |
|-------|-----|------|
| `--h` | 36px | 控制元件高度（desktop） |
| `--h-mobile` | 44px | 控制元件高度（mobile） |
| `--radius` | 6px | 按鈕 / 卡片圓角 |
| `--radius-lg` | 10px | 大卡片 / Modal 圓角 |
| `--radius-pill` | 18px | Pill 形狀（badge） |

### 3.2 字級

| Token | 值 | 用途 |
|-------|-----|------|
| `--fs` | 0.875rem (14px) | 基礎字級（正文、按鈕） |
| `--fs-sm` | 0.75rem (12px) | 小字級（label、badge） |
| `--fs-lg` | 1rem (16px) | 大字級（標題） |
| `--fs-xl` | 1.25rem (20px) | 區塊標題 |

### 3.3 間距

| Token | 值 | 用途 |
|-------|-----|------|
| `--gap-xs` | 4px | 最小間距（icon 與文字） |
| `--gap-sm` | 8px | 群組內間距 |
| `--gap-md` | 16px | 群組間間距 |
| `--gap-lg` | 24px | 區塊間間距 |
| `--gap-xl` | 32px | 大區塊間距 |

### 3.4 動畫

| Token | 值 | 用途 |
|-------|-----|------|
| `--transition` | 0.2s ease | 標準動畫時間 |
| `--transition-fast` | 0.1s ease | 快速回饋（hover） |

### 3.5 Shadow

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | `0 1px 3px rgba(0,0,0,0.3)` | 卡片 hover |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` | `0 4px 12px rgba(0,0,0,0.4)` | 浮動面板 |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.16)` | `0 8px 24px rgba(0,0,0,0.5)` | Modal |

---

## 4. 色彩系統（CSS 變數）

### 4.1 基礎色彩

| 變數 | Light | Dark | 用途 |
|------|-------|------|------|
| `--bg` | `#f5f5f5` | `#1a1a2e` | 頁面背景 |
| `--surface` | `#ffffff` | `#16213e` | 卡片 / 面板 |
| `--surface-2` | `#f8f9fa` | `#0f3460` | 次要面板（filter bar） |
| `--border` | `#e0e0e0` | `#2a2a4a` | 邊框 |
| `--text` | `#333333` | `#e0e0e0` | 主要文字 |
| `--muted` | `#888888` | `#888888` | 次要文字 |
| `--accent` | `#e60012` | `#ff4444` | 主要品牌色（Nintendo Red） |
| `--accent-hover` | `#c5000f` | `#e03030` | 品牌色 hover |
| `--success` | `#388e3c` | `#4caf50` | 成功 / 折扣標籤 |
| `--warning` | `#ff6b00` | `#ff9800` | 警告 / 折扣標籤 |
| `--danger` | `#d32f2f` | `#ef5350` | 錯誤 |
| `--focus-ring` | `rgba(230,0,18,0.4)` | `rgba(255,68,68,0.4)` | Focus ring color |

### 4.2 特殊色彩

| 變數 | Light | Dark | 用途 |
|------|-------|------|------|
| `--skeleton` | `#e0e0e0` | `#2a2a4a` | Skeleton 基底 |
| `--skeleton-shine` | `#f0f0f0` | `#3a3a5a` | Skeleton shimmer |
| `--badge-switch2` | `#e60012` | `#ff4444` | Switch 2 badge |

---

## 5. 狀態矩陣

### 5.1 GameCard

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **idle** | 白底卡片、border `--border`、封面 3:4、標題 2 行截斷 | 靜態顯示 |
| **hover** | `translateY(-2px)` + `shadow-md`、action 按鈕漸顯 | 觸發 hover 動畫 |
| **focus** | 2px `--focus-ring` outline，offset 2px | Tab 鍵可達，Tab 順序：wishlist → ignore |
| **active** | 卡片稍微縮小 `scale(0.98)` | 按下時回饋 |
| **disabled** | 無（所有卡片始終可互動） | — |
| **loading** | 顯示 skeleton（封面 shimmer + 內容 shimmer） | 無互動 |
| **error** | 顯示 error icon + 錯誤訊息 + retry 按鈕 | 點擊 retry 重新載入 |
| **empty** | 顯示空狀態插圖 + 說明文字 | 無互動 |
| **ignored** | `opacity: 0.5`、封面灰階 | 點擊 ignore 按鈕取消忽略 |
| **wishlisted** | wishlisted 按鈕 highlighted | 點擊星號 toggle |

### 5.2 FilterBar

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **idle** | 白底面板、border `--border`、搜尋框 + 2 個 pill filter | 靜態 |
| **hover** | 各 control 微微變化 | — |
| **focus** | input/select 顯示 focus ring | Tab 可達 |
| **active** | 搜尋框輸入中、pill 按鈕 active state | 實時篩選 |
| **disabled** | loading 時所有 control disabled | — |
| **empty input** | 清除按鈕隱藏 | — |

### 5.3 Nav（Header）

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **idle** | 白字 on red bg | — |
| **hover** | `rgba(255,255,255,0.2)` 背景 | — |
| **focus** | 2px white outline | Tab 可達 |
| **active** | `router-link-active` class：更深背景 + bottom border | — |

### 5.4 Skeleton

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **loading** | shimmer 動畫：從左到右漸亮線條 | 無互動 |
| **loaded** | 淡出 skeleton，淡入真實內容 | — |

### 5.5 Error State

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **error** | 圖示 + 訊息 + retry 按鈕 | 點擊 retry 重新載入 |

### 5.6 Empty State

| 狀態 | 視覺 | 互動 |
|------|------|------|
| **empty** | 插圖 + 說明文字 | 無互動 |

---

## 6. RWD 行為表

| 斷點 | Header | FilterBar | Grid | GameCard |
|------|--------|-----------|------|----------|
| ≥1024 | 水平排列、logo + nav inline | 水平排列：搜尋 + pill filters | 4–5 欄 | 標準（封面 + 內容 + actions） |
| 768–1023 | 水平排列 | 水平排列（搜尋 + filters 同行） | 2–3 欄 | 標準 |
| ≤767 | 垂直堆疊：logo + nav 上下 | 垂直堆疊：搜尋 → filters | 1–2 欄 | 緊湊（封面 + 內容水平排列） |

### 6.1 Header 行為

- **≥1024**：`flex-direction: row`，logo 左、nav 右
- **768–1023**：`flex-direction: row`，logo + nav 並排
- **≤767**：`flex-direction: column`，logo 在上、nav 在下（水平排列 tabs）

### 6.2 FilterBar 行為

- **≥1024**：搜尋框 + pill filters 同行
- **768–1023**：搜尋框 + pill filters 同行，pill 縮小
- **≤767**：搜尋框全寬、pill filters 垂直堆疊

### 6.3 Grid 行為

- **≥1024**：`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`
- **768–1023**：`grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`
- **≤767**：`grid-template-columns: repeat(2, 1fr)` 或 `1fr`

### 6.4 GameCard 行為

- **≥768**：標準垂直佈局（封面在上、內容在下）
- **≤767**：緊湊佈局（封面左 + 內容右，`flex-direction: row`），或維持垂直但縮小間距

---

## 7. 無障礙清單

| WCAG | 要求 | 實作方式 |
|------|------|----------|
| 1.1.1 | 非文字內容 | 所有 `<img>` 有 `alt` 屬性 |
| 1.4.1 | 不以顏色單獨傳達 | 折扣標籤含文字「-30%」，不只靠顏色 |
| 1.4.3 | 對比度 ≥4.5:1 | 所有文字色彩符合 AA 標準 |
| 1.4.4 | 文字可調整至 200% | 使用 rem 單位，支援瀏覽器 zoom |
| 2.1.1 | 鍵盤可操作 | 所有 `<button>` / `<a>` 可 Tab 到達 |
| 2.4.7 | Focus ring 可見 | 所有互動元件有 `:focus-visible` style |
| 2.5.5 | 觸控 ≥40px | 所有 button / link 最小 44px（mobile） |
| 4.1.2 | Name, Role, Value | `aria-label`、`aria-pressed`、`role` |

### 7.1 鍵盤操作

- **Tab**：依序：搜尋框 → platform filter → sort filter → 每張卡片（wishlist → ignore）
- **Enter/Space**：觸發 button 點擊
- **Escape**：清除搜尋框（可選）

### 7.2 ARIA

- FilterBar pill buttons：`aria-pressed` 表示選取狀態
- GameCard ignore/wishlist buttons：`aria-label` 動態切換
- Loading state：`role="status"` + `aria-live="polite"`
- Error state：`role="alert"`

---

## 8. 實作建議

### 優先順序

| 優先級 | 任務 | 工作量 |
|--------|------|--------|
| **P0** | Design Token 系統（CSS 變數） | 0.5d |
| **P0** | Dark theme 切換（`[data-theme]`） | 0.5d |
| **P0** | RWD 斷點（`@media` queries） | 1d |
| **P1** | Skeleton loading 替代文字 | 0.5d |
| **P1** | Focus ring + 鍵盤導覽 | 0.5d |
| **P1** | inline SVG 取代 emoji | 0.5d |
| **P2** | Error retry 機制 | 0.5d |
| **P2** | 空狀態插圖 | 0.5d |
| **P2** | GameCard 響應式佈局（mobile 緊湊） | 0.5d |
| **P3** | prefers-reduced-motion | 0.25d |
| **P3** | 抽取共用 layout | 0.5d |
| **P3** | 自訂 pill filter（取代原生 select） | 1d |

### 技術方案

1. **Dark Theme**：使用 `[data-theme="dark"]` 在 `<html>` 上切換 CSS 變數
2. **RWD**：使用 `@media (max-width: 767px)` 和 `@media (max-width: 1023px)` 斷點
3. **Skeleton**：使用 CSS `@keyframes shimmer` + `linear-gradient` 動畫
4. **SVG Icons**：抽取 `components/icons/` 目錄，每個 icon 一個 `.vue` component
5. **共用 Layout**：抽取 `GameGrid.vue` 組件，包含 loading/error/empty 狀態
6. **Pill Filter**：使用 `<button role="radio">` + `aria-checked` 實作自訂 radio group

---

## 9. 驗收清單

### 設計階段
- [ ] Design Token 系統完成（CSS 變數）
- [ ] Dark theme 所有元件可讀
- [ ] RWD 三個斷點行為正確
- [ ] 狀態矩陣覆蓋所有元件
- [ ] 無障礙清單通過 WCAG AA

### 實作階段
- [ ] 所有控制元件高度一致（36px desktop / 44px mobile）
- [ ] Focus ring 可見且不被截斷
- [ ] Skeleton loading 動畫流暢
- [ ] Error retry 機制正常
- [ ] 乾模式下（`prefers-reduced-motion: reduce`）無動畫
- [ ] 所有圖示為 inline SVG
- [ ] Dark theme 下所有文字對比度 ≥4.5:1
- [ ] Mobile 觸控區域 ≥44px

### 驗證階段
- [ ] Headless browser 驗證無 console error
- [ ] HTML 標籤平衡
- [ ] 鍵盤操作測試通過
- [ ] 主題切換正常運作
- [ ] 裝置切換正常運作
