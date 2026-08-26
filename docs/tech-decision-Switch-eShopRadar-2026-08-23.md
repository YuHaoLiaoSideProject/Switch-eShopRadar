# 開發方案決策文件：Switch eShop Radar

## 📌 決策摘要

| 項目 | 內容 |
|------|------|
| **採用方案** | GitHub Actions 排程爬蟲 + 分檔 JSON 資料倉庫 + GitHub Pages 靜態前端（Vue 3） |
| **決策日期** | 2026-08-23 |
| **參與討論** | 專案發起人 + AI Facilitator（tech-assessment-generator） |
| **共識程度** | ✅ 一致通過 |
| **部署平台** | GitHub Pages（純靜態托管）＋ GitHub Actions（爬蟲排程），全案收斂於單一平台、零外部服務 |

---

## 1. 需求回顧

### 共識摘要

| 項目 | 決議 |
|------|------|
| 專案目標 | Switch（1 代 & 2 代）數位版遊戲價格追蹤雷達 |
| 使用規模 | 親友團 10~50 人；無帳號系統，使用者偏好各自存於瀏覽器 localStorage |
| 資料地區 | 台灣區 eShop 為主（單一 region，簡化首版複雜度） |
| 熱門遊戲定義 | 原規劃 Nintendo 下載榜；**Spike 發現台灣區無公開網頁版榜單**，改用替代訊號（詳見 §2 資料來源） |
| 通知方式 | 不做主動推播，以網頁瀏覽為主 |
| 專案定位 | 長期經營的 side project，願意前期投資架構設計 |

### 功能範圍

**MVP（第一波）**
1. 🔥 熱門遊戲（Metacritic 評分 + 折扣活動綜合指標）
2. 💸 折扣最多排行
3. 🚫 忽略清單／排除清單（前端 localStorage，隱藏不想看到的遊戲）

**MVP 後第二波**
4. 📈 價格歷史曲線 + 史低標記（Deku Deals 式）
5. 🕵️ 假折扣偵測（偵測「先漲價再打折」的誤導性折扣）
6. 🆕 新發售追蹤頁（Switch 2 新作尤其有感）
7. ⭐ 願望清單（收藏想買的遊戲，集中管理）

### 爬蟲注意事項（從 Spike 推導）

- **Algolia 索引**：US 區索引 `store_all_products_en_us`（app `U3B6GR4UA3`）可正常使用；需留意免費額度（AlgoSec 限制），建議每日批量查詢一次即可。
- **price API `lang` 參數**：`zh-TW` 會回 400，**必須用 `zh` 或 `en`**（實測 `zh` 可用）。
- **冪等性**：同一日內重複觸發 cron 應無副作用——latest.json 每次全量覆蓋，history delta 只記錄與前日差異，重複寫入相同內容無害。

### 已知外部環境風險

Nintendo eShop 相關 API（price API、Algolia 搜尋索引、下載榜頁面）皆為**非官方介面**，可能無預警改版。架構須預留資料來源可替換性（adapter pattern）；且因資料每日 commit 進 git，「爬蟲壞掉」只是停止更新，既有資料不會遺失。

---

## 2. 系統架構

```
┌─────────────────────────────┐
│ GitHub Actions (cron: 每日)  │
│  ┌───────────────────────┐  │
│  │ crawler (TypeScript)  │  │
│  │ ① Algolia 索引：遊戲   │  │
│  │   主檔（含 Switch 2）  │  │
│  │ ② price API：台灣區    │  │
│  │   價格（批次查詢）     │  │
│  │ ③ 熱門指標：Metacritic/  │  │
│  │   OpenCritic + 折扣活動   │  │
│  └──────────┬────────────┘  │
└─────────────┼───────────────┘
              ▼ delta 計算後 commit
┌─────────────────────────────┐
│ repo /data                  │
│ ├── games.json    (主檔)    │
│ ├── latest.json   (現價快照)│
│ └── history/YYYY-MM.json    │
│     (每日變動 delta)        │
└─────────────┬───────────────┘
              ▼ build 讀取 / 前端 lazy load
┌─────────────────────────────┐
│ GitHub Pages                │
│ Vue 3 SPA                   │
│ ├─ 熱門遊戲頁（Metacritic）    │
│ ├─ 折扣最多排行             │
│ ├─ 新發售頁（P2）           │
│ └─ 偏好存 localStorage      │
│    （忽略清單／願望清單）    │
└─────────────────────────────┘
```

### 資料來源（2026-08-23 Spike 實測結果）

| 用途 | 來源 | 實測結果 |
|------|------|---------|
| 價格／折扣 | `api.ec.nintendo.com/v1/price?country=TW&lang=zh&ids=` | ✅ 可用。**lang 參數已變必填**（`zh-TW` 會 400，須用 `zh` 或 `en`）；**批次上限 50 筆**；回傳 `sales_status` / `regular_price(TWD)` / `gold_point` / 折扣時附 `discount_price` |
| 目錄種子 A | 官方台灣軟體一覽 `nintendo.com/tw/software/switch` | ✅ 可用，但**僅涵蓋任天堂發行約 82 款**（含 NSUID、封面圖） |
| 目錄種子 B（輔助） | US Algolia app `U3B6GR4UA3`（key `a29c6927638bfd8cee23993e51e721c9`），index `store_all_products_en_us` | ✅ 可用，含 `corePlatforms` 欄位可辨識 Switch 1/2；惟為美區目錄，作跨區名稱比對輔助 |
| 遊戲詳情驗證 | `ec.nintendo.com/TW/zh/titles/{id}` | ✅ 個別頁可用（Next.js SPA） |
| ❌ 舊 Deku Deals Algolia app `HN2A646K8F` | - | 已 NXDOMAIN 失效 |
| ❌ 台灣區下載排行榜 | - | **無公開網頁版**（僅主機內 eShop），「熱門」改用替代訊號 |
| 🔥 熱門遊戲替代訊號 | Metacritic API / OpenCritic API | ⏳ 待驗證（Spike P2）：評分 + 折扣頻率作為熱門排序依據；需確認 API 免費额度與速率限制 |
| 🔥 折扣活動訊號 | price API 歷史 delta | ✅ 可用：從 history 資料計算近期折扣次數，輔助熱門排序 |

**目錄覆蓋策略**：台灣區無單一完整目錄 API，採「多來源種子 + 自我成長」——
1. 官方軟體一覽頁做初始種子
2. 新遊戲偵測：定期比對官方一覽與其他種子來源
3. NSUID 一旦進入資料庫即永久追蹤 → 覆蓋率隨時間收斂至完整

**「熱門遊戲」替代方案**（原下載榜不可行）：
- 主要：Metacritic/OpenCritic 評分 + 折扣次數/降價頻率的綜合指標
- 輔助：官方一覽的排序位置、US 區暢銷訊號 cross-reference

### 核心設計原則

- **全 GitHub 單一平台**：爬蟲（Actions）、排程（cron）、資料料儲存（repo）、託管（Pages）皆在同一處，零月費、零額外帳號。
- **Delta 只存變動**：每日僅記錄價格「與前日不同」的遊戲，日增約 10~60 KB（年增 5~20 MB），repo 成長可控。
- **Adapter pattern 隔離資料來源**：三個資料來源各自獨立模組，任一改版只動一個檔案。
- **天然容錯**：爬蟲故障只代表資料停更，歷史資料完整保留在 git。
- **資料即開放資料集**：所有歷史價格都在 git 中，具備版本化、可回溯特性。

---

## 3. 技術棧

| 層級 | 技術 | 版本 | 備註 |
|------|------|------|------|
| 爬蟲 | Node.js + TypeScript | 20 LTS+ | 跑在 GitHub Actions ubuntu-latest；與前端共用型別定義 |
| HTTP client | ofetch / undici | latest | 含 retry、rate-limit 處理 |
| HTML 解析（目錄頁） | cheerio | 1.x | 官方台灣軟體一覽頁爬取（初始種子） |
| 前端框架 | Vue 3 | 3.5+ | Composition API + `<script setup>` |
| 建置工具 | Vite | 6.x | 同時負責 Pages 部署 build |
| 狀態管理 | Pinia | 2.x+ | 含 localStorage persistence plugin |
| 圖表（Phase 2） | ECharts / Chart.js | - | 價格歷史曲線用 |
| UI 元件 | Naive UI / PrimeVue（擇一） | - | 長期專案建議引入元件庫保持一致性 |
| CI/CD | GitHub Actions | - | 爬蟲排程 + 前端部署同一平台 |

### 資料契約（data schema 方向）

```jsonc
// games.json — 遊戲主檔
{ "id": "70010000000186", "title": "The Legend of Zelda: BOTW",
  "platform": "switch1" /* switch1 | switch2 */, "cover": "...", "releaseDate": "..." }

// history/2026-09.json — 只記「當日與前一日不同」的價格
{ "2026-09-01": [ { "id": "70010000000186", "price": 1490, "discountPercent": 30,
                    "discountStart": "...", "discountEnd": "..." } ] }
```

---

## 4. 初期任務拆分

| 優先級 | 任務 | 預估工時 | 依賴 |
|--------|------|---------|------|
| P0 | Spike：驗證 price API / Algolia 索引 / 下載榜可抓性 | 0.5d | - |
| P0 | 專案骨架：monorepo（crawler/ + web/）+ TS config + Actions workflow | 1d | #1 |
| P0 | Crawler：遊戲主檔抓取（含 platform 判定 switch1/switch2） | 1d | #1 |
| P0 | Crawler：台灣區價格批次抓取 + latest.json 產出 | 1d | #1 |
| P0 | Delta 引擎：比對前日、寫入 history/YYYY-MM.json、自動 commit | 1d | #3,#4 |
| P1 | 前端骨架：Vue3 + Vite + Pages 部署 pipeline | 0.5d | #2 |
| P1 | 頁面：折扣最多排行 | 1d | #5,#6 |
| P1 | 頁面：熱門遊戲（Metacritic 評分 + 折扣活動） | 1d | #5,#6 |
| P1 | 忽略清單（localStorage + Pinia persist） | 0.5d | #6 |
| P2 | Crawler：Metacritic/OpenCritic 爬蟲（熱門指標） | 1d | #4 |
| P2 | 價格歷史曲線 + 史低標記 | 2d | #5,#6 |
| P2 | 假折扣偵測（比對歷史均價 vs 折扣前價） | 1d | 歷史資料累積 |
| P2 | 新發售追蹤頁 | 0.5d | #3 |
| P2 | 願望清單 | 1d | #9 |

> MVP 合計約 7~8 個工作天即可上線第一版。

### Spike 驗證結果（2026-08-23）

- [x] price API 批次上限實測 → **50 筆**；`country=TW` 可用但 **lang 變必填且不支援 `zh-TW`**
- [x] Switch 2 辨識欄位 → US Algolia 新索引 `store_all_products_en_us` 的 `corePlatforms`
- [x] 台灣區下載榜 → **不存在公開網頁版**，「熱門」定義已調整為評分+折扣活動綜合指標
- [ ] Actions cron 排程 + git push token 權限（contents: write）設定 → 實作時驗證
- [ ] Pages 100MB 單檔 / 1GB 站點限制下的長期資料成長追蹤 → 上線後觀察
- [ ] Metacritic / OpenCritic API 可用性 → 免費额度、速率限制、Switch 遊戲覆蓋率
- [ ] Algolia US 索引免費額度 → 每日查詢一次的實際消耗
- [x] 完整台灣區目錄來源 → 無單一 API，採多來源種子策略（見 §2）

---

## 5. 風險登錄

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| 非官方 API 改版／封鎖 | 中 | 高 | Adapter pattern 隔離資料來源；資料已在 git，壞了不丟資；社群（deku-deals 等）通常很快有新端點情報 |
| Repo 隨歷史資料肥大 | 低 | 中 | Delta 模式年增 5~20 MB；若超過門檻啟動混合式（舊資料打包 Release asset，repo 只留近 12 個月） |
| Actions 排程不準時／被停用（60 天無活動） | 中 | 低 | repo 有每日 commit 即有活動；必要時改 external cron 觸發（workflow_dispatch + repository_dispatch） |
| Metacritic / OpenCritic API 變動 | 中 | 中 | Adapter 隔離 + 失敗時使用上次快取的評分 + 開 issue 通知 |
| localStorage 偏好無法跨裝置 | 低（已被接受） | 低 | 未來提供匯出/匯入 JSON |

---

## 📝 決策後續

- 本文件存放於 `docs/tech-decision-Switch-eShopRadar-2026-08-23.md`，請納入版本控制
- 建議 **MVP 上線後 1 個月** 回顧：API 穩定性、資料量實際成長是否符合 delta 估算
- 觸發重新評估的條件：
  1. repo 年增超過 50 MB → 啟動混合式儲存（舊資料打包 Release asset）
  2. 出現跨裝置同步的真實需求 → 另行評估輕量後端
  3. 主要 API 斷供超過一週 → 重選資料來源
