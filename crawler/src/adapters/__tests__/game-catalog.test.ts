import { describe, it, expect } from 'vitest';
import { parseNintendoTWCatalogHtml } from '../game-catalog';

// ─── Fixture: minimal HTML mimicking Nintendo TW software page ───

const VALID_HTML = `
<html>
<body>
  <div class="content">
    <a href="/tw/games/detail/70010000000186">The Legend of Zelda: Tears of the Kingdom</a>
    <a href="/tw/games/detail/70010000000200">Super Mario Bros. Wonder</a>
    <a href="/tw/games/detail/70010000000300">Pokemon Scarlet</a>
    <!-- Non-NSUID links should be ignored -->
    <a href="/tw/news/12345">News Article</a>
    <a href="/tw/games/detail/not-a-number">Invalid Game</a>
    <!-- Extra attributes on the element -->
    <a href="/tw/games/detail/70010000000400" class="game-link">Metroid Dread</a>
  </div>
</body>
</html>
`;

const EMPTY_HTML = `<html><body><p>No games here</p></body></html>`;

const MALFORMED_HTML = `this is not html at all {{{`;

const HTML_WITH_NSUID_IN_TEXT = `
<html>
<body>
  <div class="product">
    <span class="nsuid">70010000000500</span>
    <span class="title">Fire Emblem Engage</span>
  </div>
  <div class="product">
    <span class="nsuid">70010000000600</span>
    <span class="title">Xenoblade Chronicles 3</span>
  </div>
</body>
</html>
`;

describe('parseNintendoTWCatalogHtml', () => {
  describe('should parse NSUIDs from HTML', () => {
    it('should extract 14-digit NSUIDs starting with 7001 from href links', () => {
      const result = parseNintendoTWCatalogHtml(VALID_HTML);

      const nsuids = result.map((g) => g.nsuid);
      expect(nsuids).toContain('70010000000186');
      expect(nsuids).toContain('70010000000200');
      expect(nsuids).toContain('70010000000300');
      expect(nsuids).toContain('70010000000400');
    });

    it('should not include non-NSUID links', () => {
      const result = parseNintendoTWCatalogHtml(VALID_HTML);

      const nsuids = result.map((g) => g.nsuid);
      expect(nsuids).not.toContain('12345');
      expect(nsuids).not.toContain('not-a-number');
    });

    it('should extract NSUIDs from text content (data attributes, spans)', () => {
      const result = parseNintendoTWCatalogHtml(HTML_WITH_NSUID_IN_TEXT);

      const nsuids = result.map((g) => g.nsuid);
      expect(nsuids).toContain('70010000000500');
      expect(nsuids).toContain('70010000000600');
    });
  });

  describe('should extract game titles near NSUIDs', () => {
    it('should get title from link text when NSUID is in href', () => {
      const result = parseNintendoTWCatalogHtml(VALID_HTML);

      const zelda = result.find((g) => g.nsuid === '70010000000186');
      expect(zelda).toBeDefined();
      expect(zelda!.title).toBe('The Legend of Zelda: Tears of the Kingdom');
    });

    it('should get title from sibling/nearby element', () => {
      const result = parseNintendoTWCatalogHtml(HTML_WITH_NSUID_IN_TEXT);

      const fe = result.find((g) => g.nsuid === '70010000000500');
      expect(fe).toBeDefined();
      expect(fe!.title).toBe('Fire Emblem Engage');
    });

    it('should use NSUID as fallback title when no text found', () => {
      const html = `<html><body><a href="/tw/games/detail/70010000000999"></a></body></html>`;
      const result = parseNintendoTWCatalogHtml(html);

      expect(result).toHaveLength(1);
      expect(result[0].nsuid).toBe('70010000000999');
      // Title should fall back to something reasonable
      expect(result[0].title).toBeTruthy();
    });
  });

  describe('should return empty array for invalid HTML', () => {
    it('should return empty array for HTML with no NSUIDs', () => {
      const result = parseNintendoTWCatalogHtml(EMPTY_HTML);
      expect(result).toEqual([]);
    });

    it('should return empty array for malformed HTML', () => {
      const result = parseNintendoTWCatalogHtml(MALFORMED_HTML);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseNintendoTWCatalogHtml('');
      expect(result).toEqual([]);
    });
  });

  describe('should deduplicate NSUIDs', () => {
    it('should not return duplicate entries for the same NSUID', () => {
      const html = `
        <html><body>
          <a href="/tw/games/detail/70010000000186">Zelda</a>
          <a href="/tw/games/detail/70010000000186">Zelda again</a>
        </body></html>
      `;
      const result = parseNintendoTWCatalogHtml(html);
      expect(result).toHaveLength(1);
    });
  });
});
