import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenCriticAdapter } from '../opencritic';

// ─── Mock ofetch ────────────────────────────────────────────

const mockOfetch = vi.fn();
vi.mock('ofetch', () => ({
  ofetch: (...args: unknown[]) => mockOfetch(...args),
}));

// ─── Tests ──────────────────────────────────────────────────

describe('OpenCriticAdapter', () => {
  let adapter: OpenCriticAdapter;

  beforeEach(() => {
    mockOfetch.mockReset();
    adapter = new OpenCriticAdapter('test-api-key');
  });

  describe('getTopGames', () => {
    it('should return top games list', async () => {
      const mockGames = [
        { id: 1, name: 'Zelda BotW', topCriticScore: 97, tier: 'Mighty' },
        { id: 2, name: 'Mario Odyssey', topCriticScore: 97, tier: 'Mighty' },
      ];
      mockOfetch.mockResolvedValueOnce(mockGames);

      const result = await adapter.getTopGames();

      expect(result).toEqual(mockGames);
      expect(mockOfetch).toHaveBeenCalledWith(
        expect.stringContaining('/game?sort=topScore'),
        expect.any(Object),
      );
    });

    it('should return empty array on error', async () => {
      mockOfetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await adapter.getTopGames();

      expect(result).toEqual([]);
    });
  });

  describe('matchGamesWithScores', () => {
    it('should match games by title similarity', async () => {
      // Mock getTopGames response
      mockOfetch.mockResolvedValueOnce([
        { id: 100, name: 'Zelda', topCriticScore: 97, tier: 'Mighty' },
        { id: 200, name: 'Super Mario Odyssey', topCriticScore: 97, tier: 'Mighty' },
        { id: 300, name: 'Unrelated Game', topCriticScore: 80, tier: 'Great' },
      ]);

      const ourGames = [
        { id: 'game-1', title: 'Zelda' },
        { id: 'game-2', title: 'Super Mario Odyssey' },
        { id: 'game-3', title: 'Some Other Game' },
      ];

      const result = await adapter.matchGamesWithScores(ourGames);

      // Should match Zelda (exact match) and Mario (exact match)
      expect(result.size).toBe(2);
      expect(result.has('game-1')).toBe(true); // Zelda matched
      expect(result.has('game-2')).toBe(true); // Mario matched
    });

    it('should return empty map when no matches found', async () => {
      mockOfetch.mockResolvedValueOnce([
        { id: 100, name: 'Completely Different Game', topCriticScore: 80, tier: 'Good' },
      ]);

      const ourGames = [
        { id: 'game-1', title: 'Nintendo Game' },
      ];

      const result = await adapter.matchGamesWithScores(ourGames);

      expect(result.size).toBe(0);
    });

    it('should return empty map on API error', async () => {
      mockOfetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await adapter.matchGamesWithScores([
        { id: 'game-1', title: 'Test' },
      ]);

      expect(result.size).toBe(0);
    });
  });

  describe('searchGame', () => {
    it('should return best match from search results', async () => {
      mockOfetch.mockResolvedValueOnce([
        { id: 100, name: 'Similar Game', dist: 0.3 },
        { id: 200, name: 'The Legend of Zelda: BotW', dist: 0.1 },
        { id: 300, name: 'Another Game', dist: 0.5 },
      ]);

      const result = await adapter.searchGame('Zelda Breath');

      expect(result).toEqual({ id: 200, name: 'The Legend of Zelda: BotW', dist: 0.1 });
    });

    it('should return null for empty results', async () => {
      mockOfetch.mockResolvedValueOnce([]);

      const result = await adapter.searchGame('Nonexistent Game');

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockOfetch.mockRejectedValue(new Error('API Error'));

      const result = await adapter.searchGame('Test');

      expect(result).toBeNull();
    });
  });

  describe('getGame', () => {
    it('should return game details', async () => {
      const mockGame = {
        id: 14343,
        name: 'Zelda: TotK',
        topCriticScore: 96,
        tier: 'Mighty',
        Platforms: [{ id: 32, name: 'Nintendo Switch', shortName: 'NS' }],
      };
      mockOfetch.mockResolvedValueOnce(mockGame);

      const result = await adapter.getGame(14343);

      expect(result).toEqual(mockGame);
    });

    it('should return null on error', async () => {
      mockOfetch.mockRejectedValue(new Error('Not found'));

      const result = await adapter.getGame(99999);

      expect(result).toBeNull();
    });
  });

  describe('findGameScore', () => {
    it('should return score for found game', async () => {
      // Search result
      mockOfetch.mockResolvedValueOnce([
        { id: 14343, name: 'Zelda: TotK', dist: 0.05 },
      ]);
      // Game details
      mockOfetch.mockResolvedValueOnce({
        id: 14343,
        name: 'Zelda: TotK',
        topCriticScore: 96,
        tier: 'Mighty',
      });

      const result = await adapter.findGameScore('The Legend of Zelda: Tears of the Kingdom');

      expect(result).toEqual({
        openCriticId: 14343,
        score: 96,
        tier: 'Mighty',
      });
    });

    it('should return null for poor match (dist > 0.5)', async () => {
      mockOfetch.mockResolvedValueOnce([
        { id: 100, name: 'Completely Different Game', dist: 0.8 },
      ]);

      const result = await adapter.findGameScore('Zelda');

      expect(result).toBeNull();
    });

    it('should handle null score', async () => {
      mockOfetch.mockResolvedValueOnce([
        { id: 100, name: 'New Game', dist: 0.1 },
      ]);
      mockOfetch.mockResolvedValueOnce({
        id: 100,
        name: 'New Game',
        topCriticScore: null,
        tier: '',
      });

      const result = await adapter.findGameScore('New Game');

      expect(result).toEqual({
        openCriticId: 100,
        score: null,
        tier: '',
      });
    });
  });

  describe('findScoresForGames', () => {
    it('should batch fetch scores with limit', async () => {
      const games = [
        { id: '1', title: 'Game A' },
        { id: '2', title: 'Game B' },
      ];

      // Game A - search + get
      mockOfetch.mockResolvedValueOnce([{ id: 100, name: 'Game A', dist: 0.1 }]);
      mockOfetch.mockResolvedValueOnce({ id: 100, name: 'Game A', topCriticScore: 85, tier: 'Great' });

      // Game B - search + get
      mockOfetch.mockResolvedValueOnce([{ id: 200, name: 'Game B', dist: 0.2 }]);
      mockOfetch.mockResolvedValueOnce({ id: 200, name: 'Game B', topCriticScore: 72, tier: 'Good' });

      const result = await adapter.findScoresForGames(games, 2);

      expect(result.size).toBe(2);
      expect(result.get('1')).toEqual({ openCriticId: 100, score: 85, tier: 'Great' });
      expect(result.get('2')).toEqual({ openCriticId: 200, score: 72, tier: 'Good' });
    });

    it('should respect limit parameter', async () => {
      const games = [
        { id: '1', title: 'Game A' },
        { id: '2', title: 'Game B' },
      ];

      // Only Game A searched (limit = 1)
      mockOfetch.mockResolvedValueOnce([{ id: 100, name: 'Game A', dist: 0.1 }]);
      mockOfetch.mockResolvedValueOnce({ id: 100, name: 'Game A', topCriticScore: 85, tier: 'Great' });

      const result = await adapter.findScoresForGames(games, 1);

      expect(result.size).toBe(1);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
    });
  });
});
