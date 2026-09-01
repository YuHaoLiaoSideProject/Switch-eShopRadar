import * as cheerio from 'cheerio';
import type { Game } from '@eshop/shared';

// ─── NSUID extraction helpers ───────────────────────────────

const NSUID_REGEX = /\b700[17]\d{10}\b/g;

export interface ParsedCatalogEntry {
  nsuid: string;
  title: string;
  coverUrl?: string;
  platform?: 'switch1' | 'switch2';
  releaseDate?: string;
}

// ─── Input sanitization helpers ──────────────────────────────

/**
 * Validate a cover URL: only allow https:// absolute URLs or
 * root-relative paths starting with `/`.
 * Returns empty string for anything else.
 */
function sanitizeCoverUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return '';
}

/**
 * Clean a game title: strip HTML-like tags, decode common
 * HTML entities, and collapse excessive whitespace.
 */
function sanitizeTitle(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  // Strip any residual HTML tags
  let cleaned = raw.replace(/<[^>]*>/g, '');

  // 1. Decode numeric HTML entities: &#123; (decimal) and &#x1A; (hex)
  cleaned = cleaned.replace(/&#(\d+);/g, (_match, dec: string) => {
    try { return String.fromCodePoint(Number(dec)); } catch { return _match; }
  });
  cleaned = cleaned.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
    try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return _match; }
  });

  // 2. Decode common named HTML entities
  cleaned = cleaned
    // Basic XML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    // Whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    // Accented characters (ISO 8859-1 Latin-1 Supplement)
    .replace(/&aacute;/g, 'á')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&agrave;/g, 'à')
    .replace(/&Agrave;/g, 'À')
    .replace(/&acirc;/g, 'â')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&atilde;/g, 'ã')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&auml;/g, 'ä')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&aring;/g, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&aelig;/g, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&egrave;/g, 'è')
    .replace(/&Egrave;/g, 'È')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&Ecirc;/g, 'Ê')
    .replace(/&euml;/g, 'ë')
    .replace(/&Euml;/g, 'Ë')
    .replace(/&iacute;/g, 'í')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&igrave;/g, 'ì')
    .replace(/&Igrave;/g, 'Ì')
    .replace(/&icirc;/g, 'î')
    .replace(/&Icirc;/g, 'Î')
    .replace(/&iuml;/g, 'ï')
    .replace(/&Iuml;/g, 'Ï')
    .replace(/&oacute;/g, 'ó')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&ograve;/g, 'ò')
    .replace(/&Ograve;/g, 'Ò')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&Ocirc;/g, 'Ô')
    .replace(/&otilde;/g, 'õ')
    .replace(/&Otilde;/g, 'Õ')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&oslash;/g, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&Ugrave;/g, 'Ù')
    .replace(/&ucirc;/g, 'û')
    .replace(/&Ucirc;/g, 'Û')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&yacute;/g, 'ý')
    .replace(/&Yacute;/g, 'Ý')
    .replace(/&yuml;/g, 'ÿ')
    .replace(/&Yuml;/g, 'Ÿ')
    // Other Latin characters
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&szlig;/g, 'ß')
    .replace(/&thorn;/g, 'þ')
    .replace(/&Thorn;/g, 'Þ')
    .replace(/&eth;/g, 'ð')
    .replace(/&ETH;/g, 'Ð')
    // Typographic / curly quotes & dashes
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&sbquo;/g, '\u201A')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&bdquo;/g, '\u201E')
    .replace(/&dagger;/g, '†')
    .replace(/&Dagger;/g, '‡')
    .replace(/&bull;/g, '•')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&permil;/g, '‰')
    .replace(/&prime;/g, '\u2032')
    .replace(/&Prime;/g, '\u2033')
    .replace(/&lsaquo;/g, '‹')
    .replace(/&rsaquo;/g, '›')
    // Misc common symbols
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&cent;/g, '¢')
    .replace(/&pound;/g, '£')
    .replace(/&yen;/g, '¥')
    .replace(/&euro;/g, '€')
    .replace(/&curren;/g, '¤')
    .replace(/&sect;/g, '§')
    .replace(/&para;/g, '¶')
    .replace(/&larr;/g, '←')
    .replace(/&rarr;/g, '→')
    .replace(/&uarr;/g, '↑')
    .replace(/&darr;/g, '↓')
    .replace(/&harr;/g, '↔')
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&plusmn;/g, '±')
    .replace(/&not;/g, '¬')
    .replace(/&micro;/g, 'µ')
    .replace(/&middot;/g, '·')
    .replace(/&frac14;/g, '¼')
    .replace(/&frac12;/g, '½')
    .replace(/&frac34;/g, '¾')
    .replace(/&iquest;/g, '¿')
    .replace(/&iexcl;/g, '¡')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»');

  // Collapse multiple whitespace / newlines into a single space
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Sanitize an NSUID string: must match the expected 14-digit
 * pattern starting with 7001; returns empty string otherwise.
 */
function sanitizeNsuid(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return /^700[17]\d{10}$/.test(trimmed) ? trimmed : '';
}

/**
 * Build a cover image URL from NSUID using Nintendo's CDN.
 */
export function buildCoverUrl(
  nsuid: string,
  cdn = 'https://store.nintendo.com.hk/media/catalog/product',
): string {
  if (!nsuid) return '';
  return `${cdn}/${nsuid}.jpg`;
}

/**
 * Convert ParsedCatalogEntry to Game type with defaults.
 */
export function toGame(
  entry: ParsedCatalogEntry,
  coverCdn?: string,
): Game {
  const nsuid = sanitizeNsuid(entry.nsuid);
  const providedCover = sanitizeCoverUrl(entry.coverUrl ?? '');

  return {
    id: nsuid,
    title: sanitizeTitle(entry.title),
    platform: entry.platform ?? 'switch1',
    coverUrl: providedCover || buildCoverUrl(nsuid, coverCdn),
    releaseDate: entry.releaseDate ?? '',
  };
}

/**
 * Parse raw HTML from the Nintendo TW software page and extract
 * NSUIDs (14-digit numbers starting with 7001) with nearby titles.
 */
export interface NintendoJsonGame {
  title: string;
  link: string;
  thumb_img: string;
  release_date: string;
  platform?: string;
  [key: string]: unknown;
}

/**
 * Parse Nintendo TW/HK JSON catalog and extract NSUIDs with titles.
 */
export function parseNintendoCatalogJson(data: unknown): ParsedCatalogEntry[] {
  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const entries: ParsedCatalogEntry[] = [];

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const game = item as NintendoJsonGame;

    // Extract NSUID from link (e.g., "https://store.nintendo.com.hk/70010000049989")
    const linkStr = typeof game.link === 'string' ? game.link : '';
    const nsuidMatch = linkStr.match(/700[17]\d{10}/);
    if (!nsuidMatch) continue;

    const nsuid = nsuidMatch[0];
    if (seen.has(nsuid)) continue;
    seen.add(nsuid);

    const title = typeof game.title === 'string' ? sanitizeTitle(game.title) : '';
    const coverUrl = typeof game.thumb_img === 'string' ? sanitizeCoverUrl(game.thumb_img) : '';
    const releaseDate = typeof game.release_date === 'string' ? game.release_date : '';

    entries.push({
      nsuid,
      title: title || `Game ${nsuid}`,
      coverUrl,
      releaseDate,
    });
  }

  return entries;
}

export function parseNintendoTWCatalogHtml(html: string): ParsedCatalogEntry[] {
  if (typeof html !== 'string') return [];
  if (html.length === 0) return [];

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
        // Look for cover image in parent container
        let coverUrl = '';
        const container = $(el).closest('[class*="product"], [class*="game"], [class*="card"], [class*="item"], li, article');
        if (container.length) {
          const img = container.find('img').first();
          coverUrl = img.attr('src') ?? img.attr('data-src') ?? '';
        }
        // Fallback: look for img sibling or child
        if (!coverUrl) {
          const parent = $(el).parent();
          const img = parent.find('img').first();
          coverUrl = img.attr('src') ?? img.attr('data-src') ?? '';
        }
        entries.push({ nsuid, title: sanitizeTitle(title) || `Game ${nsuid}`, coverUrl: sanitizeCoverUrl(coverUrl) });
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
          entries.push({ nsuid, title: sanitizeTitle(title) || `Game ${nsuid}` });
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
