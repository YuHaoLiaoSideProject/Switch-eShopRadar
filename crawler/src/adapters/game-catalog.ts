import type { Game } from '@eshop/shared';
import * as cheerio from 'cheerio';

// ─── Adapter Interface ──────────────────────────────────────

export interface GameCatalogAdapter {
  fetchCatalog(platform?: 'switch1' | 'switch2'): Promise<Game[]>;
}

// ─── NSUID extraction helpers ───────────────────────────────

const NSUID_REGEX = /\b7001\d{10}\b/g;

export interface ParsedCatalogEntry {
  nsuid: string;
  title: string;
}

/**
 * Parse raw HTML from the Nintendo TW software page and extract
 * NSUIDs (14-digit numbers starting with 7001) with nearby titles.
 */
export function parseNintendoTWCatalogHtml(html: string): ParsedCatalogEntry[] {
  if (!html || typeof html !== 'string') return [];

  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const entries: ParsedCatalogEntry[] = [];

  // Strategy 1: Extract NSUIDs from href attributes (most common pattern)
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/7001\d{10}/);
    if (match) {
      const nsuid = match[0];
      if (!seen.has(nsuid)) {
        seen.add(nsuid);
        // Get title from link text, trimmed
        let title = $(el).text().trim();
        if (!title) {
          // Fallback: look for nearby text in parent/sibling
          title = $(el).parent().text().trim().replace(nsuid, '').trim();
        }
        entries.push({ nsuid, title: title || `Game ${nsuid}` });
      }
    }
  });

  // Strategy 2: Extract NSUIDs from text content (span, div, data attributes)
  // Only add if not already found via href
  $('[class*="nsuid"], [class*="nsuid"], [data-nsuid]').each((_i, el) => {
    const text = $(el).text().trim();
    const dataNsuid = $(el).attr('data-nsuid');
    const raw = dataNsuid || text;
    const matches = raw.match(NSUID_REGEX);
    if (matches) {
      for (const nsuid of matches) {
        if (!seen.has(nsuid)) {
          seen.add(nsuid);
          // Try to find a nearby title
          const parent = $(el).parent();
          let title = '';
          // Look for a sibling or child with title-like class
          const titleEl = parent.find('[class*="title"], [class*="name"]').first();
          if (titleEl.length) {
            title = titleEl.text().trim();
          }
          if (!title) {
            // Look for next sibling text
            title = $(el).next().text().trim();
          }
          if (!title) {
            // Use parent text minus the NSUID
            title = parent.text().trim().replace(nsuid, '').trim();
          }
          entries.push({ nsuid, title: title || `Game ${nsuid}` });
        }
      }
    }
  });

  // Strategy 3: Broad scan of entire HTML for any 7001xxxxxxxxxx pattern
  // that wasn't caught above
  const allText = $.text();
  const broadMatches = allText.match(NSUID_REGEX);
  if (broadMatches) {
    for (const nsuid of broadMatches) {
      if (!seen.has(nsuid)) {
        seen.add(nsuid);
        entries.push({ nsuid, title: `Game ${nsuid}` });
      }
    }
  }

  return entries;
}

// ─── TW Catalog Adapter (real API) ─────────────────────────

export class NintendoTWCatalog implements GameCatalogAdapter {
  private readonly catalogUrl: string;

  constructor(catalogUrl: string = 'https://www.nintendo.com/tw/software/switch') {
    this.catalogUrl = catalogUrl;
  }

  async fetchCatalog(_platform: 'switch1' | 'switch2' = 'switch1'): Promise<Game[]> {
    // Will be implemented in fetcher.ts orchestration using ofetch
    // This adapter just does the HTML parsing
    throw new Error('Use parseNintendoTWCatalogHtml for HTML parsing; fetchCatalog is orchestrated by fetcher');
  }
}
