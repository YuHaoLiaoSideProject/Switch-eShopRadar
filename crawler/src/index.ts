console.log('[crawler] 🎮 Switch eShop Radar crawler started');

async function main(): Promise<void> {
  // TODO: wire up adapters → fetch → computeDelta → write JSON
  console.log('[crawler] main() — not yet implemented');
}

main().catch((err) => {
  console.error('[crawler] Fatal error:', err);
  process.exit(1);
});
