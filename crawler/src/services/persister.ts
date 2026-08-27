import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Game, PriceSnapshot, PriceDelta } from '@eshop/shared';

// ─── Directory Structure ────────────────────────────────────

export interface PersistPaths {
  dataDir: string;
  gamesPath: string;
  latestPath: string;
}

/**
 * Build standard paths for a given data directory.
 */
export function buildPaths(dataDir: string): PersistPaths {
  return {
    dataDir,
    gamesPath: path.join(dataDir, 'games.json'),
    latestPath: path.join(dataDir, 'latest.json'),
  };
}

// ─── Write Games ────────────────────────────────────────────

/**
 * Write the game catalog to games.json.
 * Merges with existing data to preserve fields like coverUrl, platform, releaseDate.
 */
export function writeGames(games: Game[], dataDir: string): void {
  const { gamesPath } = buildPaths(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  // Merge with existing games to preserve coverUrl, platform, releaseDate
  let existing = new Map<string, Game>();
  if (fs.existsSync(gamesPath)) {
    try {
      const content = fs.readFileSync(gamesPath, 'utf-8');
      const arr = JSON.parse(content) as Game[];
      for (const g of arr) {
        existing.set(g.id, g);
      }
    } catch (err) {
      console.warn(`[persister] Failed to parse ${gamesPath}, starting from empty catalog:`, err);
    }
  }

  // Update with new data, preserving existing fields
  for (const game of games) {
    const prev = existing.get(game.id);
    if (prev) {
      existing.set(game.id, {
        ...prev,
        ...game,
        // Prefer existing coverUrl/platform/releaseDate if new value is empty
        coverUrl: game.coverUrl || prev.coverUrl,
        platform: game.platform || prev.platform,
        releaseDate: game.releaseDate || prev.releaseDate,
      });
    } else {
      existing.set(game.id, game);
    }
  }

  const merged = Array.from(existing.values()).sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(gamesPath, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Read the game catalog from disk.
 */
export function readGames(dataDir: string): Game[] {
  const { gamesPath } = buildPaths(dataDir);

  if (!fs.existsSync(gamesPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(gamesPath, 'utf-8');
    return JSON.parse(content) as Game[];
  } catch (err) {
    console.warn(`[persister] Failed to parse ${gamesPath}, returning empty list:`, err);
    return [];
  }
}

/**
 * Update game scores from OpenCritic data.
 * Only updates games that don't have a score yet, or forces update if force=true.
 */
export function updateGameScores(
  scores: Map<string, { score: number | null; openCriticId?: number }>,
  dataDir: string,
  force = false,
): number {
  const games = readGames(dataDir);
  let updated = 0;

  for (const game of games) {
    const scoreData = scores.get(game.id);
    if (!scoreData) continue;

    // Skip if already has score and not forcing update
    if (game.rating !== undefined && game.rating !== null && !force) continue;

    // Only update if we have a valid score
    if (scoreData.score !== null && scoreData.score > 0) {
      game.rating = Math.round(scoreData.score);
      updated++;
    }
  }

  if (updated > 0) {
    writeGames(games, dataDir);
  }

  return updated;
}

// ─── Atomic Write Helper ───────────────────────────────────

/**
 * Write JSON data to `targetPath` using an atomic write strategy:
 *  1. Back up existing file to `<targetPath>.bak` (if it exists).
 *  2. Write new content to `<targetPath>.tmp`.
 *  3. Rename `.tmp` → target.
 *  4. On rename failure, attempt to restore from `.bak`.
 *  5. On success, remove `.bak` if present.
 */
function atomicWrite(targetPath: string, data: unknown): void {
  const tmpPath = `${targetPath}.tmp`;
  const bakPath = `${targetPath}.bak`;
  const content = JSON.stringify(data, null, 2);

  // Step 1: back up current file (best-effort)
  try {
    if (fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, bakPath);
    }
  } catch {
    // If backup fails we still proceed — the original file remains untouched
    // until the rename below, so data is not lost.
  }

  // Step 2–3: write tmp then rename
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    // Clean up tmp file on failure
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch { /* ignore cleanup errors */ }

    // Step 4: attempt restore from backup
    try {
      if (fs.existsSync(bakPath)) {
        fs.copyFileSync(bakPath, targetPath);
      }
    } catch { /* ignore restore errors */ }

    throw err;
  }

  // Step 5: clean up backup on successful write
  try {
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
  } catch { /* ignore cleanup errors */ }
}

// ─── Write Latest ───────────────────────────────────────────

/**
 * Write the latest price snapshot to latest.json.
 * Creates the data directory if it doesn't exist.
 */
export function writeLatest(snapshot: PriceSnapshot, dataDir: string): void {
  const { latestPath } = buildPaths(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  atomicWrite(latestPath, snapshot);
}

/**
 * Read the latest snapshot from disk, or return null if not found.
 */
export function readLatest(dataDir: string): PriceSnapshot | null {
  const { latestPath } = buildPaths(dataDir);

  if (!fs.existsSync(latestPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(latestPath, 'utf-8');
    return JSON.parse(content) as PriceSnapshot;
  } catch (err) {
    console.warn(`[persister] Failed to parse ${latestPath}, returning null:`, err);
    return null;
  }
}

// ─── Daily Snapshot ─────────────────────────────────────────

/**
 * Write a daily snapshot to data/YYYY-MM-dd.json.
 */
export function writeDailySnapshot(snapshot: PriceSnapshot, dataDir: string): void {
  const filePath = path.join(dataDir, `${snapshot.date}.json`);
  fs.mkdirSync(dataDir, { recursive: true });
  atomicWrite(filePath, snapshot);
}

/**
 * Get the date of the most recent daily snapshot.
 */
export function getLatestSnapshotDate(dataDir: string): string | null {
  if (!fs.existsSync(dataDir)) return null;
  
  const files = fs.readdirSync(dataDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  
  return files.length > 0 ? files[0].replace('.json', '') : null;
}

/**
 * Read a daily snapshot by date.
 */
export function readDailySnapshot(date: string, dataDir: string): PriceSnapshot | null {
  const filePath = path.join(dataDir, `${date}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as PriceSnapshot;
  } catch (err) {
    console.warn(`[persister] Failed to parse ${filePath}, returning null:`, err);
    return null;
  }
}
