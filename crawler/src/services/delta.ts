import type { PriceSnapshot, PriceDelta } from '@eshop/shared';

/**
 * Compute the delta between two price snapshots.
 * Compares by game id and reports all field-level changes.
 */
export function computeDelta(oldSnap: PriceSnapshot, newSnap: PriceSnapshot): PriceDelta {
  const oldMap = new Map(oldSnap.prices.map((p) => [p.id, p]));
  const newMap = new Map(newSnap.prices.map((p) => [p.id, p]));

  const changes: PriceDelta['changes'] = [];

  // Check all games in new snapshot
  for (const [id, newRecord] of newMap) {
    const oldRecord = oldMap.get(id);

    if (!oldRecord) {
      // New game appeared
      changes.push({ id, from: {}, to: pickFields(newRecord) });
      continue;
    }

    if (!isSamePrice(oldRecord, newRecord)) {
      changes.push({
        id,
        from: pickFields(oldRecord),
        to: pickFields(newRecord),
      });
    }
  }

  // Games removed from new snapshot
  for (const [id] of oldMap) {
    if (!newMap.has(id)) {
      // Could track removals if needed; for now skip
    }
  }

  return {
    date: newSnap.date,
    changes,
  };
}

function pickFields(record: PriceSnapshot['prices'][number]): Partial<PriceSnapshot['prices'][number]> {
  return {
    id: record.id,
    amount: record.amount,
    currency: record.currency,
    regularPrice: record.regularPrice,
    discountPrice: record.discountPrice,
    discountPercent: record.discountPercent,
    discountStart: record.discountStart,
    discountEnd: record.discountEnd,
    salesStatus: record.salesStatus,
    goldPoint: record.goldPoint,
  };
}

function isSamePrice(
  a: PriceSnapshot['prices'][number],
  b: PriceSnapshot['prices'][number],
): boolean {
  return (
    a.id === b.id &&
    a.amount === b.amount &&
    a.regularPrice === b.regularPrice &&
    a.discountPrice === b.discountPrice &&
    a.discountPercent === b.discountPercent &&
    a.discountStart === b.discountStart &&
    a.discountEnd === b.discountEnd &&
    a.salesStatus === b.salesStatus &&
    a.goldPoint?.basicGiftRate === b.goldPoint?.basicGiftRate &&
    a.goldPoint?.basicGiftGp === b.goldPoint?.basicGiftGp
  );
}
