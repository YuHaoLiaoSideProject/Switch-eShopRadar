import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useLocalStorage } from '@/composables/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default value when localStorage is empty', () => {
    const { value } = useLocalStorage('test-key', 'default');
    expect(value.value).toBe('default');
  });

  it('should return stored value when localStorage has data', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { value } = useLocalStorage('test-key', 'default');
    expect(value.value).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { value } = useLocalStorage('test-key', 'initial');
    value.value = 'updated';
    const stored = JSON.parse(localStorage.getItem('test-key') || 'null');
    expect(stored).toBe('updated');
  });

  it('should handle JSON serialization for objects', () => {
    const defaultObj = { items: [] as number[], count: 0 };
    const { value } = useLocalStorage('obj-key', defaultObj);
    expect(value.value).toEqual(defaultObj);

    value.value = { items: [1, 2, 3], count: 3 };
    const stored = JSON.parse(localStorage.getItem('obj-key') || '{}');
    expect(stored).toEqual({ items: [1, 2, 3], count: 3 });
  });

  it('should handle JSON serialization for arrays', () => {
    const { value } = useLocalStorage<string[]>('arr-key', []);
    value.value = ['a', 'b', 'c'];
    const stored = JSON.parse(localStorage.getItem('arr-key') || '[]');
    expect(stored).toEqual(['a', 'b', 'c']);
  });

  it('should handle numeric values', () => {
    const { value } = useLocalStorage('num-key', 0);
    value.value = 42;
    const stored = JSON.parse(localStorage.getItem('num-key') || '0');
    expect(stored).toBe(42);
  });

  it('should handle boolean values', () => {
    const { value } = useLocalStorage('bool-key', false);
    value.value = true;
    const stored = JSON.parse(localStorage.getItem('bool-key') || 'false');
    expect(stored).toBe(true);
  });

  it('should return default value for corrupted data', () => {
    localStorage.setItem('corrupt-key', 'not-valid-json{{{');
    const { value } = useLocalStorage('corrupt-key', 'fallback');
    expect(value.value).toBe('fallback');
  });

  it('should react to external localStorage changes via sync', () => {
    const { value } = useLocalStorage('sync-key', 'initial');
    expect(value.value).toBe('initial');

    // Simulate external change
    localStorage.setItem('sync-key', JSON.stringify('external'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sync-key' }));
    expect(value.value).toBe('external');
  });
});
