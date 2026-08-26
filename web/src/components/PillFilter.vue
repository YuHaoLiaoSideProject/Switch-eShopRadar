<script setup lang="ts">
interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  modelValue: string;
  name: string;
}

defineProps<Props>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function handleKeydown(e: KeyboardEvent, currentValue: string, options: Option[]) {
  const idx = options.findIndex((o) => o.value === currentValue);
  let nextIdx = idx;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    nextIdx = (idx + 1) % options.length;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    nextIdx = (idx - 1 + options.length) % options.length;
  } else if (e.key === 'Home') {
    e.preventDefault();
    nextIdx = 0;
  } else if (e.key === 'End') {
    e.preventDefault();
    nextIdx = options.length - 1;
  } else {
    return;
  }

  emit('update:modelValue', options[nextIdx].value);
}
</script>

<template>
  <div
    class="pill-filter"
    role="radiogroup"
    :aria-label="name"
    @keydown="handleKeydown($event, modelValue, options)"
  >
    <button
      v-for="option in options"
      :key="option.value"
      ref="pillRefs"
      class="pill-filter__item"
      :class="{ 'pill-filter__item--active': option.value === modelValue }"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.pill-filter {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
}

.pill-filter__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--h);
  min-width: var(--h);
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
    transform var(--transition-fast),
    box-shadow var(--transition);
  white-space: nowrap;
}

.pill-filter__item:hover {
  background: var(--border);
}

.pill-filter__item--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.pill-filter__item--active:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.pill-filter__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.pill-filter__item:active {
  transform: scale(0.95);
}

@media (max-width: 767px) {
  .pill-filter__item {
    height: var(--h-mobile);
    min-width: var(--h-mobile);
    font-size: var(--fs-lg);
    padding: 0 var(--gap-md);
  }
}
</style>
