import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeLatest, readLatest, appendDelta, readDeltas } from '../persister';
import type { PriceSnapshot, PriceDelta } from '@eshop/shared';

// ─── Test Helpers ───────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eshop-persister-test-'));
}

function makeSnapshot(date: string, overrides?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    date,
    prices: [
      {
        id: '70010000000186',
        amount: 1790,
        currency: 'TWD',
        regularPrice: 1790,
        salesStatus: 'onsale',
      },
    ],
    ...overrides,
  };
}

function makeDelta(date: string): PriceDelta {
  return {
    date,
    changes: [
      {
        id: '70010000000186',
        from: { amount: 1790 },
        to: { amount: 1199, discountPrice: 1199 },
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('writeLatest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write latest.json to data directory', () => {
    const snapshot = makeSnapshot('2025-01-15');

    writeLatest(snapshot, tmpDir);

    const filePath = path.join(tmpDir, 'latest.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.date).toBe('2025-01-15');
    expect(content.prices).toHaveLength(1);
  });

  it('should create directory if not exists', () => {
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'data');
    const snapshot = makeSnapshot('2025-01-15');

    writeLatest(snapshot, nestedDir);

    expect(fs.existsSync(path.join(nestedDir, 'latest.json'))).toBe(true);
  });

  it('should overwrite existing latest.json', () => {
    const snap1 = makeSnapshot('2025-01-15');
    const snap2 = makeSnapshot('2025-01-16');

    writeLatest(snap1, tmpDir);
    writeLatest(snap2, tmpDir);

    const content = JSON.parse(fs.readFileSync(path.join(tmpDir, 'latest.json'), 'utf-8'));
    expect(content.date).toBe('2025-01-16');
  });

  it('should write valid JSON', () => {
    const snapshot = makeSnapshot('2025-01-15');

    writeLatest(snapshot, tmpDir);

    const raw = fs.readFileSync(path.join(tmpDir, 'latest.json'), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('readLatest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when file does not exist', () => {
    expect(readLatest(tmpDir)).toBeNull();
  });

  it('should read previously written snapshot', () => {
    const snapshot = makeSnapshot('2025-01-15');
    writeLatest(snapshot, tmpDir);

    const result = readLatest(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2025-01-15');
  });

  it('should return null for corrupted JSON', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'latest.json'), '{invalid json', 'utf-8');

    expect(readLatest(tmpDir)).toBeNull();
  });
});

describe('appendDelta', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create history/YYYY-MM.json if not exists', () => {
    const delta = makeDelta('2025-01-15');

    appendDelta(delta, tmpDir);

    const filePath = path.join(tmpDir, 'history', '2025-01.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content).toHaveLength(1);
    expect(content[0].date).toBe('2025-01-15');
  });

  it('should append delta to existing file', () => {
    const delta1 = makeDelta('2025-01-15');
    const delta2 = makeDelta('2025-01-16');

    appendDelta(delta1, tmpDir);
    appendDelta(delta2, tmpDir);

    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'history', '2025-01.json'), 'utf-8'),
    );
    expect(content).toHaveLength(2);
    expect(content[0].date).toBe('2025-01-15');
    expect(content[1].date).toBe('2025-01-16');
  });

  it('should not duplicate same-day delta (idempotent)', () => {
    const delta = makeDelta('2025-01-15');

    appendDelta(delta, tmpDir);
    appendDelta(delta, tmpDir);

    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'history', '2025-01.json'), 'utf-8'),
    );
    expect(content).toHaveLength(1);
  });

  it('should create history directory if not exists', () => {
    const nestedDir = path.join(tmpDir, 'deep', 'data');
    const delta = makeDelta('2025-01-15');

    appendDelta(delta, nestedDir);

    expect(fs.existsSync(path.join(nestedDir, 'history', '2025-01.json'))).toBe(true);
  });

  it('should handle corrupted existing file gracefully', () => {
    const historyDir = path.join(tmpDir, 'history');
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(path.join(historyDir, '2025-01.json'), 'not json', 'utf-8');

    const delta = makeDelta('2025-01-15');
    appendDelta(delta, tmpDir);

    const content = JSON.parse(
      fs.readFileSync(path.join(historyDir, '2025-01.json'), 'utf-8'),
    );
    expect(content).toHaveLength(1);
    expect(content[0].date).toBe('2025-01-15');
  });

  it('should write valid JSON', () => {
    const delta = makeDelta('2025-01-15');
    appendDelta(delta, tmpDir);

    const raw = fs.readFileSync(path.join(tmpDir, 'history', '2025-01.json'), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('readDeltas', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty array when no file exists', () => {
    expect(readDeltas('2025-01', tmpDir)).toEqual([]);
  });

  it('should read deltas from file', () => {
    const delta = makeDelta('2025-01-15');
    appendDelta(delta, tmpDir);

    const result = readDeltas('2025-01', tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
  });
});
