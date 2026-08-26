import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PriceSnapshot, PriceDelta } from '@eshop/shared';

// ─── Directory Structure ────────────────────────────────────

export interface PersistPaths {
  dataDir: string;
  latestPath: string;
  historyDir: string;
}

/**
 * Build standard paths for a given data directory.
 */
export function buildPaths(dataDir: string): PersistPaths {
  return {
    dataDir,
    latestPath: path.join(dataDir, 'latest.json'),
    historyDir: path.join(dataDir, 'history'),
  };
}

// ─── Write Latest ───────────────────────────────────────────

/**
 * Write the latest price snapshot to latest.json.
 * Creates the data directory if it doesn't exist.
 */
export function writeLatest(snapshot: PriceSnapshot, dataDir: string): void {
  const { latestPath } = buildPaths(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2), 'utf-8');
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
  } catch {
    return null;
  }
}

// ─── Append Delta ───────────────────────────────────────────

/**
 * Append a delta to history/YYYY-MM.json.
 * - Creates the history directory if it doesn't exist.
 * - Creates the file with an array if it doesn't exist.
 * - Appends the delta to the existing array.
 * - Idempotent: won't add duplicate deltas for the same date.
 */
export function appendDelta(delta: PriceDelta, dataDir: string): void {
  const { historyDir } = buildPaths(dataDir);
  const month = delta.date.slice(0, 7); // YYYY-MM
  const filePath = path.join(historyDir, `${month}.json`);

  fs.mkdirSync(historyDir, { recursive: true });

  let existing: PriceDelta[] = [];

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      existing = JSON.parse(content) as PriceDelta[];
    } catch {
      existing = [];
    }
  }

  // Idempotent: check if delta for this exact date already exists
  const alreadyExists = existing.some((d) => d.date === delta.date);
  if (!alreadyExists) {
    existing.push(delta);
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * Read all deltas for a given month (YYYY-MM).
 */
export function readDeltas(month: string, dataDir: string): PriceDelta[] {
  const { historyDir } = buildPaths(dataDir);
  const filePath = path.join(historyDir, `${month}.json`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as PriceDelta[];
  } catch {
    return [];
  }
}
