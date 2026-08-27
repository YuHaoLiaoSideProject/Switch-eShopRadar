<script setup lang="ts">
import PillFilter from './PillFilter.vue';
import type { Platform } from '@/types';

interface Props {
  platformFilter: Platform | 'all';
  searchQuery: string;
  sortBy: 'title' | 'price' | 'discount';
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:platformFilter', value: Platform | 'all'): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:sortBy', value: 'title' | 'price' | 'discount'): void;
}>();

const platformOptions = [
  { value: 'all', label: '全部' },
  { value: 'switch1', label: 'Switch' },
  { value: 'switch2', label: 'Switch 2' },
];

const sortOptions = [
  { value: 'title', label: '名稱' },
  { value: 'price', label: '價格' },
  { value: 'discount', label: '折扣' },
];

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSearch(value: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:searchQuery', value);
  }, 300);
}
</script>

<template>
  <div class="filter-bar">
    <!-- Search -->
    <div class="filter-bar__search">
      <div class="search-wrapper">
        <svg
          class="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <label for="search-input" class="sr-only">搜尋遊戲</label>
        <input
          id="search-input"
          type="text"
          placeholder="搜尋遊戲..."
          :value="searchQuery"
          class="search-input"
          @input="debouncedSearch(($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          aria-label="清除搜尋"
          @click="emit('update:searchQuery', '')"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Platform filter -->
    <div class="filter-bar__group">
      <PillFilter
        :options="platformOptions"
        :model-value="platformFilter"
        name="platform"
        @update:model-value="emit('update:platformFilter', $event as Platform | 'all')"
      />
    </div>

    <!-- Sort filter -->
    <div class="filter-bar__group">
      <PillFilter
        :options="sortOptions"
        :model-value="sortBy"
        name="sort"
        @update:model-value="emit('update:sortBy', $event as 'title' | 'price' | 'discount')"
      />
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-md);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--gap-lg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ── Search ── */
.filter-bar__search {
  flex: 1;
  min-width: 0;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--gap-sm);
  color: var(--muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: var(--h);
  padding: 0 var(--gap-md) 0 calc(var(--gap-sm) + 18px + var(--gap-sm));
  font-size: var(--fs);
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.search-input::placeholder {
  color: var(--muted);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.search-clear {
  position: absolute;
  right: var(--gap-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--h);
  height: var(--h);
  padding: 0;
  font-size: var(--fs-xl);
  color: var(--muted);
  background: transparent;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
  line-height: 1;
}

.search-clear:hover {
  color: var(--text);
  background: var(--surface-2);
}

.search-clear:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* ── Filter groups ── */
.filter-bar__group {
  flex-shrink: 0;
}

/* ── Mobile RWD ≤767 ── */
@media (max-width: 767px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--gap-sm);
  }

  .search-input,
  .search-clear {
    height: var(--h-mobile);
  }

  .filter-bar__group {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
