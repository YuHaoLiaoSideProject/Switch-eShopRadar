import { runFetch } from './services/fetcher';
import { computeDelta } from './services/delta';
import { writeLatest, readLatest, appendDelta, writeGames, readGames, updateGameScores } from './services/persister';
import { toGame } from './adapters/game-catalog';
import { OpenCriticAdapter } from './adapters/opencritic';

async function main(): Promise<void> {
  console.log('[crawler] 🎮 Switch eShop Radar crawler started');

  const catalogUrl = process.env.CATALOG_URL ?? 'https://www.nintendo.com/tw/software/switch';
  const priceApiBaseUrl = process.env.PRICE_API_URL ?? 'https://api.ec.nintendo.com/v1/price';
  const dataDir = process.env.DATA_DIR ?? './data';
  const country = process.env.COUNTRY ?? 'TW';
  const lang = process.env.LANG ?? 'zh';
  const openCriticKey = process.env.OPENCRITIC_API_KEY;

  // Step 1: Fetch catalog + prices
  const { snapshot, catalog } = await runFetch({
    catalogUrl,
    priceApiBaseUrl,
    country,
    lang,
  });

  console.log(`[crawler] Fetched ${snapshot.prices.length} prices from ${catalog.length} catalog entries`);

  // Step 2: Persist game catalog
  const games = catalog.map(toGame);
  writeGames(games, dataDir);
  console.log(`[crawler] Games catalog written to ${dataDir}/games.json (${games.length} games)`);

  // Step 3: Fetch OpenCritic scores (if API key provided)
  // Strategy: First match from top games list (1 API call), then search for remaining
  const openCriticSearchLimit = parseInt(process.env.OPENCRITIC_SEARCH_LIMIT ?? '10', 10);
  
  if (openCriticKey) {
    console.log('[crawler] Fetching OpenCritic scores...');
    const ocAdapter = new OpenCriticAdapter(openCriticKey);
    
    const existingGames = readGames(dataDir);
    const gamesNeedingScores = existingGames
      .filter((g) => g.rating === undefined || g.rating === null)
      .map((g) => ({ id: g.id, title: g.title }));
    
    if (gamesNeedingScores.length === 0) {
      console.log('[crawler] All games already have scores — skipping OpenCritic fetch');
    } else {
      // Phase 1: Match from top games list (1 API call)
      console.log('[crawler] Phase 1: Matching from OpenCritic top games list...');
      const topMatches = await ocAdapter.matchGamesWithScores(gamesNeedingScores);
      let totalUpdated = 0;
      
      if (topMatches.size > 0) {
        totalUpdated += updateGameScores(topMatches, dataDir);
        console.log(`[crawler] Matched ${topMatches.size} games from top list`);
      }
      
      // Phase 2: Search for remaining games (limited searches per day)
      const stillNeedScores = gamesNeedingScores.filter((g) => !topMatches.has(g.id));
      if (stillNeedScores.length > 0 && openCriticSearchLimit > 0) {
        console.log(`[crawler] Phase 2: Searching for ${Math.min(stillNeedScores.length, openCriticSearchLimit)} remaining games...`);
        const searchMatches = await ocAdapter.findScoresForGames(stillNeedScores, openCriticSearchLimit);
        if (searchMatches.size > 0) {
          totalUpdated += updateGameScores(searchMatches, dataDir);
        }
      }
      
      console.log(`[crawler] Total: Updated ${totalUpdated} game scores from OpenCritic`);
    }
  } else {
    console.log('[crawler] No OPENCRITIC_API_KEY — skipping score fetch');
  }

  // Step 4: Compute delta against previous snapshot (if any)
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

  // Step 5: Write latest snapshot
  writeLatest(snapshot, dataDir);
  console.log(`[crawler] Snapshot written to ${dataDir}/latest.json`);
}

main().catch((err) => {
  console.error('[crawler] Fatal error:', err);
  process.exit(1);
});
