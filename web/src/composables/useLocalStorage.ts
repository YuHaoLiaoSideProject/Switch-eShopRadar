import { ref, watch, onScopeDispose } from 'vue';

/**
 * Composable for reactive localStorage with JSON serialization.
 * Syncs across browser tabs via StorageEvent.
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  function read(): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  const data = ref<T>(read());

  function write(val: T) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // QuotaExceededError or other write failures — silently ignore
    }
  }

  // Watch for local changes and write to localStorage
  watch(
    data,
    (newVal) => {
      write(newVal);
    },
    { deep: true, flush: 'sync' },
  );

  // Listen for external changes (other tabs / components)
  function onStorageChange(e: StorageEvent) {
    if (e.key === key) {
      data.value = read();
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorageChange);
  }

  onScopeDispose(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorageChange);
    }
  });

  return {
    value: data,
  };
}
