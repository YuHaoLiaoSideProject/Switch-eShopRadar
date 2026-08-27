import { runFetch } from './services/fetcher';
import { computeDelta } from './services/delta';
import { writeLatest, readLatest, appendDelta } from './services/persister';

async function main(): Promise<void> {
  console.log('[crawler] 🎮 Switch eShop Radar crawler started');

  const catalogUrl = process.env.CATALOG_URL ?? 'https://www.nintendo.com/tw/software/switch';
  const priceApiBaseUrl = process.env.PRICE_API_URL ?? 'https://api.ec.nintendo.com/v1/price';
  const dataDir = process.env.DATA_DIR ?? './data';
  const country = process.env.COUNTRY ?? 'TW';
  const lang = process.env.LANG ?? 'zh';

  // Step 1: Fetch catalog + prices
  const { snapshot, catalog } = await runFetch({
    catalogUrl,
    priceApiBaseUrl,
    country,
    lang,
  });

  console.log(`[crawler] Fetched ${snapshot.prices.length} prices from ${catalog.length} catalog entries`);

  // Step 2: Compute delta against previous snapshot (if any)
  const oldSnapshot = readLatest(dataDir);
  if (oldSnapshot) {
    const delta = computeDelta(oldSnapshot, snapshot);
    if (delta.changes.length > 0) {
      appendDelta(delta, dataDir);
      console.log(`[crawler] Delta: ${delta.changes.length} change(s) detected`);
    } else {
      console.log('[crawler] No changes detected since last run');
    }
  } else {
    console.log('[crawler] No previous snapshot found — first run');
  }

  // Step 3: Write latest snapshot
  writeLatest(snapshot, dataDir);
  console.log(`[crawler] Snapshot written to ${dataDir}/latest.json`);
}

main().catch((err) => {
  console.error('[crawler] Fatal error:', err);
  process.exit(1);
});
