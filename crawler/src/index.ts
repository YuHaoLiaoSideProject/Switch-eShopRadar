import { config } from './config';
import { runFetch } from './services/fetcher';
import { computeDelta } from './services/delta';
import { writeLatest, writeGames, readGames, updateGameScores, writeDailySnapshot, getLatestSnapshotDate, readDailySnapshot } from './services/persister';
import { toGame } from './adapters/game-catalog';
import { OpenCriticAdapter } from './adapters/opencritic';
import { ImageResolver } from './adapters/image-resolver';

async function main(): Promise<void> {
  console.log('[crawler] 🎮 Switch eShop Radar crawler started');

  const {
    catalogUrl,
    priceApiBaseUrl,
    dataDir,
    country,
    lang,
    openCriticApiKey: openCriticKey,
    openCriticSearchLimit,
  } = config;

  // Step 1: Fetch catalog + prices (primary: Switch-Games.com, fallback: Nintendo API)
  const { snapshot, catalog } = await runFetch({
    catalogUrl,
    priceApiBaseUrl,
    country,
    lang,
    coverCdn: config.coverCdn,
    switchGames: config.switchGamesSupabaseUrl && config.switchGamesAnonKey
      ? { supabaseUrl: config.switchGamesSupabaseUrl, anonKey: config.switchGamesAnonKey }
      : undefined,
  });

  console.log(`[crawler] Fetched ${snapshot.prices.length} valid prices (filtered from ${catalog.length} catalog entries)`);

  // Step 2: Persist game catalog
  const games = catalog.map((e) => toGame(e, config.coverCdn));
  writeGames(games, dataDir);
  console.log(`[crawler] Games catalog written to ${dataDir}/games.json (${games.length} games)`);

  // Step 2.5: Resolve cover images from IGDB/Nintendo/Wikipedia
  console.log('[crawler] Resolving cover images...');
  const imageResolver = new ImageResolver({
    dataDir,
    cacheDir: config.cacheDir,
    requestDelayMs: 200,
    igdbClientId: config.igdbClientId,
    igdbClientSecret: config.igdbClientSecret,
  });
  const gamesToResolve = games
    .filter((g) => !g.coverUrl || g.coverUrl === '' || g.coverUrl.includes('store.nintendo.com.hk'))
    .map((g) => ({ nsuid: g.id, title: g.title }));

  if (gamesToResolve.length > 0) {
    console.log(`[crawler] ${gamesToResolve.length} games need cover images`);
    const resolved = await imageResolver.resolveBatch(
      gamesToResolve,
      (current, total) => {
        if (current % 50 === 0 || current === total) {
          console.log(`[crawler]   Resolved ${current}/${total} images...`);
        }
      },
    );

    // Update games with resolved images
    let updatedCount = 0;
    for (const game of games) {
      if (resolved.has(game.id)) {
        const { url } = resolved.get(game.id)!;
        if (url) {
          game.coverUrl = url;
          updatedCount++;
        }
      }
    }
    console.log(`[crawler] Updated ${updatedCount} cover images from Wikipedia`);
  } else {
    console.log('[crawler] All games already have cover images — skipping image resolution');
  }

  // Re-persist games with updated images
  writeGames(games, dataDir);
  const cacheStats = imageResolver.getStats();
  console.log(`[crawler] Image cache: ${cacheStats.cached} entries at ${cacheStats.path}`);

  // Step 3: Fetch OpenCritic scores (if API key provided)
  // Strategy: First match from top games list (1 API call), then search for remaining
  if (openCriticKey) {
    console.log('[crawler] Fetching OpenCritic scores...');
    const ocAdapter = new OpenCriticAdapter(openCriticKey, config.openCriticBaseUrl);
    
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

  // Step 4: Check for changes and save daily snapshot if needed
  const latestDate = getLatestSnapshotDate(dataDir);
  if (!latestDate) {
    // First run - save full snapshot
    writeDailySnapshot(snapshot, dataDir);
    console.log(`[crawler] First run — saved baseline ${snapshot.date}.json`);
  } else {
    const oldSnapshot = readDailySnapshot(latestDate, dataDir);
    if (oldSnapshot) {
      const delta = computeDelta(oldSnapshot, snapshot);
      if (delta.changes.length > 0) {
        writeDailySnapshot(snapshot, dataDir);
        console.log(`[crawler] Changes detected — saved ${snapshot.date}.json`);
      } else {
        console.log('[crawler] No changes detected since last run');
      }
    }
  }

  // Step 5: Update latest.json symlink/copy
  writeLatest(snapshot, dataDir);
  console.log(`[crawler] Latest snapshot updated`);
}

main().catch((err) => {
  console.error('[crawler] Fatal error:', err);
  process.exit(1);
});
