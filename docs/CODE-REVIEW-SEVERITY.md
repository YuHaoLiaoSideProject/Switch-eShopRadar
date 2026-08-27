# Code Review Severity Standards

> 適用於 Switch-eShopRadar 專案（Monorepo · Vue 3 + TypeScript · Node.js 爬蟲 · CI/CD）

---

## Overview

本文件定義四個嚴重度等級，用於 Code Review 時快速分類問題。Severity 決定修復的優先級與是否可合併。

---

## Severity Levels

### P0 · Critical

**定義：** 直接導致功能故障、資料遺失、安全漏洞、或阻斷 CI/CD pipeline 的問題。**必須在合併前修復。**

| 類別 | 典型範例 |
|------|---------|
| 安全 | 硬編碼 API key / credential 洩露至 repo |
| 資料完整性 | crawler delta diff 邏輯錯誤，覆蓋正確的價格資料 |
| 型別安全 | `any` 泄漏至 `packages/shared` 的公開型別，破壞下游型別推斷 |
| 管線 | `ci.yml` / `deploy.yml` / `crawler.yml` Workflow 語法錯誤，導致整個 pipeline 失敗 |
| 資源 | 無限迴圈或記憶體洩漏（例如 crawl loop 未設定止損） |
| 路由 | `router/index.ts` 路由定義衝突，SPA 導向失敗 |
| 資料流 | `data-loader.ts` fetch 錯誤未處理，導致白屏且無 fallback |

**處理優先級：** 🔴 最高 — 阻斷合併，須立即修復。

---

### P1 · Major

**定義：** 影響使用者體驗、降低可維護性、或埋下技術債的問題。**應在合併前修復，但不阻斷合併。**

| 類別 | 典型範例 |
|------|---------|
| 行為 | `games.ts` store 的 filter/sort 計算結果與預期不符（例如 hot 列表缺少折扣遊戲） |
| 效能 | 爬蟲未設定 rate limit 或 timeout，對 Nintendo API 造成壓力 |
| 型別 | Vue SFC 缺少 `lang="ts"` 或型別標註不完整 |
| 狀態管理 | Pinia store 狀態外洩（跨路由未重置），導致介面顯示舊資料 |
| 測試 | 新增功能未附帶對應的 `__tests__/` 單元測試 |
| 模組邊界 | `crawler` 直接 import `web` 內部模組，違反單向資料流 |
| 建置 | Vite build 時 `public/data/` 同步失靜態資料與 crawler 產出不一致 |
| 錯誤處理 | 非預期 exception 被靜默吞掉（`catch {}`），缺少 logging |

**處理優先級：** 🟠 高 — 應在 PR 中修復；若需 follow-up，建立 issue 追蹤。

---

### P2 · Minor

**定義：** 不影響功能但降低程式碼品質、可讀性、或一致性的問題。**建議在合併前修復。**

| 類別 | 典型範例 |
|------|---------|
| 命名 | 變數 / 函式命名含糊（例如 `data`、`tmp`、`handler`），無法表達意圖 |
| 程式碼重複 | 多個 Vue 元件重複相同的 fetch + format 邏輯，應抽取 composable |
| 慣例偏離 | SFC 未使用 `<script setup lang="ts">`，或 mixed Options API |
| 路徑 | 硬編碼路徑 `'../data/games.json'` 而非使用 workspace alias `@eshop/shared` |
| 註解 | 缺少 JSDoc 或關鍵邏輯無註解（例如 price snapshot 格式轉換） |
| 死碼 | 註解掉的程式碼塊或未使用的 import 殘留 |
| 資料型別 | JSON schema 與 `packages/shared` 的 TypeScript 型別不同步 |
| 佈局 | `<template>` 中 v-for 未帶 key，或 v-if / v-for 同時使用 |

**處理優先級：** 🟡 中 — 建議修復；可標記為 "nit" 但不強制阻斷。

---

### P3 · Nitpick

**定義：** 純粹風格或個人偏好的微調建議。**可忽略或合併後處理。**

| 類別 | 典型範例 |
|------|---------|
| 格式 | 缺少 Prettier 格式化（應由 CI 自動修正） |
| 空白 | 結尾空白、多餘空行、tab vs space 混用 |
| 排序 | import 排序未按字母順序或未分組（external / internal / type） |
| 註解風格 | 註解用語不一致（中文 vs 英文混用） |
| 微調 | 函式參數順序可調整以提高可讀性 |
| 縮寫 | 偶爾使用縮寫（`idx`、`fn`）但上下文清晰 |

**處理優先級：** 🟢 低 — 可在合併後由 lint / formatter 自動處理，或視情況忽略。

---

## Quick Reference

| Severity | 標籤 | 合併前修復 | 代表色 |
|----------|------|------------|--------|
| P0 · Critical | `severity/critical` | ✅ 必須 | 🔴 Red |
| P1 · Major | `severity/major` | ✅ 應該 | 🟠 Orange |
| P2 · Minor | `severity/minor` | ⚠️ 建議 | 🟡 Yellow |
| P3 · Nitpick | `severity/nit` | ❌ 選擇性 | 🟢 Green |

---

## 工作流程

1. Reviewer 在 PR comment 中標註 severity（例如 `severity/major`）。
2. 自動化 CI 可標記 `severity/critical`（型別檢查失敗、lint error 等）。
3. 合併條件：P0 清零 + 至少一位 Maintainer Approve。
4. P1 項目若無法即時修復，建立 Issue 並以 `follow-up` label 追蹤。

---

*Last updated: 2025-01-18*
