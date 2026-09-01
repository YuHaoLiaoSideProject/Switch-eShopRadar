# switch-games.com 網站 API 分析與呼叫難易度評估報告

> 分析日期：2026-08-28
> 來源：第三方網站 switch-games.com

---

## 1. 核心結論概述

| 評估項目 | 分析結果 | 說明 |
|---------|---------|------|
| 是否有官方公開 API | 否 | 網站並未提供對外開放的官方開發者 API 或公開說明文件。 |
| 是否有內部可用 API | 是 | 前端採用 SPA 架構，透過 Supabase 後端（PostgREST 與 Edge Functions）提供資料讀取。 |
| 呼叫難易度評級 | 低～中等 | 取得前端暴露的 SUPABASE_URL 與 anon_key 後，即可直接用 HTTP 客戶端（cURL / Fetch / Python）查詢公開資料。 |
| 長期穩定性 | 中～低 | 屬於內部私有端點，作者隨時可能調整資料庫結構、修改 RLS（資料列安全規則）或啟用反爬蟲機制。 |

---

## 2. 網站架構與技術棧分析

根據網站前端特徵與錯誤回報資訊分析：

- **前端架構**：基於 React / Vite / Tailwind CSS 構建的單頁應用程式（SPA），專案產生自 Lovable 平台。
- **後端服務**：採用 Supabase 作為 Backend-as-a-Service (BaaS)。
- **資料庫查詢**：PostgREST（直接以 RESTful 方式對 PostgreSQL 進行 CRUD/過濾）。
- **自訂業務邏輯**：Supabase Edge Functions（處理即時匯率、各國價格抓取或爬蟲任務）。
- **資料來源**：任天堂各地區 eShop（US, JP, HK, TW 等）之商品與價格資料。

---

## 3. 網站內部 API 端點清單

### (1) 遊戲資料與搜尋 API (Supabase PostgREST)

Supabase 會將 PostgreSQL 資料表自動轉為 RESTful API。

**端點格式**：`https://<project-ref>.supabase.co/rest/v1/<table_name>`
**請求方法**：GET

**主要查詢資料表（預估名稱）**：
- `games` 或 `switch_games`：存放遊戲名稱、封面 URL、發行商、支援語言（如繁體中文）。
- `prices` 或 `game_prices`：存放各國 eShop 幣別、原價、特價、折扣截止日。

**認證 Headers**：
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**常用過濾參數 (PostgREST 語法)**：
- 關鍵字搜尋：`?title=ilike.*zelda*`
- 繁體中文支援過濾：`?has_traditional_chinese=eq.true`
- 特價中遊戲：`?on_sale=eq.true`
- 分頁與排序：`?limit=30&offset=0&order=updated_at.desc`

### (2) 價格比價與匯率聚合 API (Supabase Edge Functions)

用於跨區價格即時換算為新台幣（TWD）或即將發售遊戲列表。

**端點格式**：`https://<project-ref>.supabase.co/functions/v1/<function_name>`
**請求方法**：POST 或 GET

**常見函式名稱**：
- `/upcoming-games`：即將發售遊戲資料聚合。
- `/exchange-rates` / `/price-compare`：即時匯率轉換與各區比價排序。

**認證 Headers**：
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

---

## 4. 呼叫難易度分析與實作範例

### 難易度分析

**優勢**：
- **金鑰公開**：Supabase 的 anon 金鑰屬於客戶端公開金鑰，內嵌於打包後的 JavaScript Bundle 中，可直接透過瀏覽器開發者工具（F12 → Network）抓取。
- **標準 REST 介面**：使用標準 PostgREST 語法，支援強大的過濾、排序、分頁功能。

### 呼叫範例 (cURL / Python)

```bash
# 範例：查詢包含 Zelda 關鍵字的遊戲清單
curl -X GET "https://<project-ref>.supabase.co/rest/v1/games?title=ilike.*Zelda*&select=id,title,publisher,cover_url&limit=10" \
  -H "apikey: <YOUR_EXTRACTED_ANON_KEY>" \
  -H "Authorization: Bearer <YOUR_EXTRACTED_ANON_KEY>"
```

```python
import requests

SUPABASE_URL = "https://<project-ref>.supabase.co"
ANON_KEY = "<YOUR_EXTRACTED_ANON_KEY>"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
}

params = {
    "select": "*",
    "on_sale": "eq.true",
    "order": "discount_rate.desc",
    "limit": 20
}

response = requests.get(f"{SUPABASE_URL}/rest/v1/games", headers=headers, params=params)
print(response.json())
```

---

## 5. 風險評估與使用建議

| 風險類別 | 說明 |
|---------|------|
| 未公開的私有 API | 服務提供方並無義務維持介面穩定，隨時可能修改 Schema 或更新 Function。 |
| RLS (Row Level Security) 限制 | 若開發者開啟嚴格的 RLS 或限制特定 IP/Referer，可能隨時失效。 |
| 流量配額限制 | Supabase 免費層級（Free Tier）對 API 呼叫次數與頻寬有上限，高頻率呼叫可能導致端點被限流（429 Too Many Requests）。 |

---

## 6. 替代方案推薦（更穩定之開源/官方方案）

若欲建構穩定的 Switch 遊戲資料抓取或比價服務，建議考慮以下替代方案：

1. **Nintendo 官方 Algolia Search API**：任天堂官方美區/歐區 eShop 搜尋後端採用 Algolia，提供公開可用的 App ID 與 Search Key，可直接取得全量官方遊戲資料與美金價格。
2. **開源 Python / Node.js SDK**：
   - `nintendo-switch-eshop` (npm)
   - `nintendo_eshop` (Python)
   - 已封裝美、日、歐、港、台等區官方 eShop 查詢邏輯。

---

## 7. 與 Switch eShop Radar 專案的整合建議

### 現有資料來源
- Nintendo 官方 Price API（`api.ec.nintendo.com/v1/price`）
- Nintendo TW/HK JSON catalog
- OpenCritic API（via RapidAPI）

### switch-games.com 的潛在價值
| 特性 | 現有方案 | switch-games.com |
|------|----------|------------------|
| 資料完整性 | 需自行爬取多區 API | 已聚合多區資料 |
| 搜尋功能 | 需前端實作 | PostgREST 支援 `ilike` 全文搜尋 |
| 繁中支援 | 需自行判斷 | 有 `has_traditional_chinese` 欄位 |
| 特價資訊 | 需計算折扣 | 已有 `on_sale` / `discount_rate` |
| 穩定性 | ✅ 官方 API | ⚠️ 私有端點，隨時可能變動 |

### 建議整合方式
作為**備援資料來源**，用於：
- 補充官方 API 缺少的欄位（如繁中支援標記、折扣率）
- 官方 API 限流時的 fallback

---

## 附錄：如何取得 Supabase 憑證

1. 開啟瀏覽器開發者工具（F12）
2. 切換到 Network 標籤
3. 造訪 switch-games.com 並執行搜尋或瀏覽操作
4. 在 Network 請求中找到 `supabase.co` 相關請求
5. 從 Request Headers 或 URL 中提取：
   - `SUPABASE_URL`：`https://<project-ref>.supabase.co`
   - `ANON_KEY`：`apikey` header 的值
