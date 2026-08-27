<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import PillFilter from './PillFilter.vue';
import type { Platform } from '@/types';

interface Props {
  platformFilter: Platform | 'all';
  searchQuery: string;
  sortBy: 'title' | 'price' | 'discount';
  showIgnored?: boolean;
  ignoredCount?: number;
}

withDefaults(defineProps<Props>(), {
  showIgnored: false,
  ignoredCount: 0,
});

const emit = defineEmits<{
  (e: 'update:platformFilter', value: Platform | 'all'): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:sortBy', value: 'title' | 'price' | 'discount'): void;
  (e: 'update:showIgnored', value: boolean): void;
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

const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

function debouncedSearch(value: string) {
  if (debounceTimer.value) clearTimeout(debounceTimer.value);
  debounceTimer.value = setTimeout(() => {
    emit('update:searchQuery', value);
  }, 300);
}

onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
    debounceTimer.value = null;
  }
});
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

    <!-- Show ignored toggle -->
    <div v-if="ignoredCount > 0" class="filter-bar__group">
      <button
        class="toggle-ignored-btn"
        :class="{ 'toggle-ignored-btn--active': showIgnored }"
        @click="emit('update:showIgnored', !showIgnored)"
        :aria-pressed="showIgnored"
        aria-label="顯示已隱藏遊戲"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 7C14.76 7 17 8.79 18.61 10.81L20.08 9.34C18.11 7.04 15.22 5.5 12 5.5C8.78 5.5 5.89 7.04 3.92 9.34L5.39 10.81C7 8.79 9.24 7 12 7ZM12 16C10.34 16 9 14.66 9 13C9 12.54 9.12 12.1 9.34 11.72L12.28 14.66C12.1 14.88 12 15.11 12 15.42C12 15.78 12.22 16 12 16Z" />
          <path d="M2 4.27L4.28 6.55L4.73 7C3.08 8.3 1.79 9.9 1 11.76C2.73 15.36 6.32 18.5 12 18.5C13.55 18.5 15.03 18.21 16.38 17.71L16.69 18.02L19.73 21.07L21 19.8L3.27 2.07L2 4.27ZM12 16.34C7.69 16.34 4.47 13.36 3.42 9.76C3.96 7.93 5.37 6.35 7.53 7.8L9.24 9.51C9.09 10 9 10.49 9 11C9 12.66 10.34 14 12 14C12.51 14 13 13.91 13.5 13.76L15.21 15.47C14.21 16.04 13.13 16.34 12 16.34Z" />
        </svg>
        <span>隱藏遊戲</span>
        <span class="toggle-ignored-btn__count">{{ ignoredCount }}</span>
      </button>
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

/* ── Toggle ignored button ── */
.toggle-ignored-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  height: var(--h);
  padding: 0 var(--gap-md);
  font-size: var(--fs);
  font-weight: 500;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition:
    background var(--transition),
    color var(--transition),
    border-color var(--transition);
  white-space: nowrap;
}

.toggle-ignored-btn:hover {
  background: var(--border);
}

.toggle-ignored-btn--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.toggle-ignored-btn--active:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.toggle-ignored-btn__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: var(--fs-sm);
  font-weight: 600;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

.toggle-ignored-btn--active .toggle-ignored-btn__count {
  background: rgba(255, 255, 255, 0.25);
}

@media (max-width: 767px) {
  .toggle-ignored-btn {
    height: var(--h-mobile);
    font-size: var(--fs-lg);
  }
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
