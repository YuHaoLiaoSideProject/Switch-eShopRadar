# Switch eShop Radar — 封面圖來源分析

## 現況

- 遊戲總數：500
- 有真實封面圖：43 (9%)
- Placeholder 圖片：457 (91%)

## 已嘗試的圖片來源

### 1. `store.nintendo.com.hk/media/catalog/product/{nsuid}.jpg`
- **狀態：❌ 失敗**
- 所有 NSUID 回傳同一張 30KB placeholder 圖片（MD5 完全相同）
- 不管用 nsuid 還是 thumb_img 檔名，結果都一樣

### 2. `fs-prod-cdn.nintendo-europe.com` (Switch-Games.com 原本的 cover_url)
- **狀態：❌ 失敗**
- 回傳 HTML 而非圖片（被擋了）

### 3. `assets.nintendo.com/image/upload/...store/software/switch/{nsuid}/{hash}`
- **狀態：⚠️ 可用，但需要 hash**
- 每個遊戲頁面的 `__NEXT_DATA__` 包含完整圖片 URL
- 圖片品質最好（有 transform 參數可調整大小/比例）
- **問題：** US store 的 NSUID 跟 TW store 不同，無法直接匹配
- **解法：** 從 seed pages 收集 hash，再用標題匹配 TW 遊戲
- **目前覆蓋率：** 22/500 (4%) — 只匹配到有英文標題的遊戲

### 4. Wikipedia API
- **狀態：⚠️ 部分可用**
- 透過英文標題搜尋 Wikipedia，取得 thumbnail 圖片
- **問題：** 大部分 TW 遊戲標題是純中文，搜尋不到
- **目前覆蓋率：** 21/500 (4%)

### 5. Nintendo.com Algolia Search API
- **狀態：❌ 失敗**
- 找到了 App ID (`U3B6GR4UA3`) 和 API Key (`a29c6927638bfd8cee23993e51e721c9`)
- 所有 index（`store_game`, `store_all_products` 等）都回傳 404
- API Key 可能被限制了

### 6. Contentful CMS API
- **狀態：❌ 失敗**
- 找到了 Space ID (`mqzfxe57488m`) 和 Access Token
- 沒有遊戲產品資料的 content type

## 技術細節

### Nintendo.com 產品頁面結構
- URL pattern: `https://www.nintendo.com/us/store/products/{slug}/`
- `__NEXT_DATA__` 包含：
  - `props.pageProps.linkedData[0].image` → 完整圖片 URL
  - `props.pageProps.openGraph.image` → OG 圖片 URL
  - `props.pageProps.initialApolloState` → 所有相關產品的 nsuid + name
- 每個產品頁面包含 100-200 個相關遊戲的 hash

### NSUID 差異
- TW store: `70070000014946` (《刀劍神域》)
- US store: `70010000000025` (Zelda BOTW)
- 兩者的 NSUID 系統不同，無法直接映射

### Seed Pages 效果
爬 20 個熱門遊戲頁面可收集到：
- 475 個 unique hashes
- 468 個 title → hash 映射
- 但只有 22 個能匹配到 TW 遊戲（透過英文標題）

## 建議的改進方向

1. **增加 seed pages** — 爬更多 Nintendo.com 頁面（100+）收集更多 hash
2. **改善標題匹配** — 從 TW catalog 提取更多英文資訊（ product code、series name 等）
3. **使用 TW store 自己的 API** — 如果能找到 TW store 的產品圖片 API
4. **第三方圖片服務** — RAWG.io、IGDB 等（需要 API key）
5. **手動補齊** — 對重要遊戲手動設定封面圖 URL

## 相關檔案

- `crawler/src/adapters/image-resolver.ts` — 圖片解析器
- `data/image-cache.json` — 圖片快取
- `data/nintendo-hash-map.json` — US store nsuid → hash 映射
- `data/nintendo-title-map.json` — US store title → hash 映射
