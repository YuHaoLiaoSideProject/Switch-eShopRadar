# Switch eShop Radar — Project Report

> Auto-generated exploration report. Source: `web/`, `crawler/`, `packages/shared/`, `.github/workflows/`.

---

## 技術棧 (Tech Stack)

1. **Monorepo (npm workspaces)** — root `package.json` defines `packages/*`, `crawler`, `web` as workspaces
2. **Vue 3** (Composition API + `<script setup>`) — Vite 6, vue-router 4 (hash mode), Pinia for state
3. **TypeScript 5.7+** — strict across all packages; `vue-tsc` for web type-checking
4. **Node.js crawler** — `tsx` runtime, `ofetch` + `cheerio` for scraping Nintendo eShop & OpenCritic
5. **Vitest 3** — unit testing per-workspace; workspace config in `vitest.workspace.ts`

---

## 架構 (Architecture)

1. **三層 Monorepo** — `packages/shared` (types + utils) ← `crawler` (data fetch) → `web` (SPA)
2. **Data Pipeline** — crawler: Nintendo eShop API → snapshot → delta diff → JSON files in `./data/`
3. **Static SPA** — web reads `./data/*.json` at runtime (copied into `web/public/data/` at build time)
4. **GitHub Pages** — `deploy.yml` builds web, uploads `dist/` to Pages; no server-side runtime
5. **Scheduled Crawler** — `crawler.yml` runs daily (UTC 02:00), commits price changes back to repo

---

## 常用指令 (Common Commands)

```bash
# Install all dependencies
npm ci

# Dev server (web)
npm run -w @eshop/web dev

# Type check (each workspace)
npm run -w @eshop/shared typecheck
npm run -w @eshop/crawler typecheck
npm run -w @eshop/web typecheck

# Run tests (all / per workspace)
npm test                         # vitest run (workspace-level)
npm run -w @eshop/web test
npm run -w @eshop/crawler test

# Build web for production
npm run -w @eshop/web build

# Run crawler locally
npm run -w @eshop/crawler start
```

---

## 慣例 (Conventions)

1. **`<script setup lang="ts">`** — Vue SFCs exclusively use Composition API with `<script setup>`
2. **Pinia stores** — composition-style (`defineStore` with setup function), one per domain (games, preferences)
3. **Path alias `@/`** — resolves to `web/src/`; `@eshop/shared` resolves to `packages/shared/src`
4. **Data flow** — crawler writes JSON → web reads static JSON; no live API calls from frontend
5. **Testing** — co-located `__tests__/` dirs per adapter/service; Vitest with jsdom for web, node for crawler

---

## 關鍵檔案 (Key Files)

| Role | Path |
|---|---|
| **Web entry point** | `web/src/main.ts` — creates Vue app, mounts Pinia + router |
| **App shell / layout** | `web/src/App.vue` — header nav, `<RouterView>`, RWD breakpoints |
| **Router** | `web/src/router/index.ts` — 3 routes: `/hot`, `/deals`, `/new` (lazy-loaded) |
| **Game store (core logic)** | `web/src/stores/games.ts` — filters, sorting, computed views (hot/deals/new) |
| **Data loader** | `web/src/services/data-loader.ts` — fetches `games.json` & `latest.json` from static dir |
| **Crawler entry** | `crawler/src/index.ts` — full pipeline: fetch → persist → OpenCritic → delta → snapshot |
| **Shared types & utils** | `packages/shared/src/index.ts` — `Game`, `PriceRecord`, `PriceSnapshot`, `computeDiscountPercent` |
| **CI pipeline** | `.github/workflows/ci.yml` — type-check + test on PR/push |
| **Deploy pipeline** | `.github/workflows/deploy.yml` — build web → GitHub Pages |
| **Crawler schedule** | `.github/workflows/crawler.yml` — daily cron, commits data changes |
