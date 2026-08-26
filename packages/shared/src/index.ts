// ─── Game Catalog Types ───────────────────────────────────────

export interface Game {
  id: string; // NSUID, e.g. "70010000000186"
  title: string;
  platform: 'switch1' | 'switch2';
  coverUrl: string;
  releaseDate: string; // ISO date
  rating?: number; // Metacritic score 0-100
}

// ─── Price Types ──────────────────────────────────────────────

export interface PriceRecord {
  id: string;
  amount: number; // TWD raw_value
  currency: 'TWD';
  regularPrice: number;
  discountPrice?: number;
  discountPercent?: number;
  discountStart?: string;
  discountEnd?: string;
  salesStatus: 'onsale' | 'preorder' | 'unreleased' | 'not_found';
  goldPoint?: {
    basicGiftRate: string;
    basicGiftGp: string;
  };
}

// ─── Snapshot / Delta Types ──────────────────────────────────

export interface PriceSnapshot {
  date: string; // YYYY-MM-DD
  prices: PriceRecord[];
}

export interface PriceDelta {
  date: string;
  changes: Array<{
    id: string;
    from: Partial<PriceRecord>;
    to: Partial<PriceRecord>;
  }>;
}

// ─── Catalog Aggregate ───────────────────────────────────────

export interface GameCatalog {
  updatedAt: string; // ISO datetime
  games: Game[];
}
