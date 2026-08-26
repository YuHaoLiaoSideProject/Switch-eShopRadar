<script setup lang="ts">
import type { Game, PriceRecord } from '@/types';
import StarIcon from './icons/StarIcon.vue';
import EyeSlashIcon from './icons/EyeSlashIcon.vue';

interface Props {
  game: Game;
  price: PriceRecord | null;
  isIgnored?: boolean;
  isWishlisted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isIgnored: false,
  isWishlisted: false,
});

const emit = defineEmits<{
  (e: 'toggle-ignore', gameId: string): void;
  (e: 'toggle-wishlist', gameId: string): void;
}>();

function formatPrice(amount: number): string {
  return `NT$${amount.toLocaleString()}`;
}

function getDiscountPercent(): number {
  if (!props.price?.discountPrice || !props.price.regularPrice) return 0;
  return Math.round(
    ((props.price.regularPrice - props.price.discountPrice) / props.price.regularPrice) * 100,
  );
}

function getPlatformLabel(platform: string): string {
  return platform === 'switch2' ? 'Switch 2' : 'Switch';
}
</script>

<template>
  <div class="game-card" :class="{ 'game-card--ignored': isIgnored }">
    <div class="game-card__image">
      <img
        :src="game.coverUrl"
        :alt="game.title"
        loading="lazy"
        @error="($event.target as HTMLImageElement).src = 'https://via.placeholder.com/300x400?text=No+Cover'"
      />
      <span class="game-card__platform">{{ getPlatformLabel(game.platform) }}</span>
    </div>

    <div class="game-card__body">
      <div class="game-card__content">
        <h3 class="game-card__title">{{ game.title }}</h3>

        <div v-if="price" class="game-card__pricing">
          <span v-if="getDiscountPercent() > 0" data-testid="discount-badge" class="game-card__discount">
            -{{ getDiscountPercent() }}%
          </span>
          <span class="game-card__current-price">
            {{ formatPrice(price.discountPrice ?? price.amount) }}
          </span>
          <span
            v-if="getDiscountPercent() > 0"
            data-testid="original-price"
            class="game-card__original-price"
          >
            {{ formatPrice(price.regularPrice) }}
          </span>
        </div>
        <div v-else class="game-card__no-price">無資料</div>
      </div>

      <div class="game-card__actions">
        <button
          data-testid="toggle-wishlist-btn"
          class="action-btn"
          :class="{ 'action-btn--active': isWishlisted }"
          :aria-label="isWishlisted ? '移除願望清單' : '加入願望清單'"
          @click="emit('toggle-wishlist', game.id)"
        >
          <StarIcon :filled="isWishlisted" />
        </button>
        <button
          data-testid="toggle-ignore-btn"
          class="action-btn"
          :class="{ 'action-btn--active': isIgnored }"
          :aria-label="isIgnored ? '取消忽略' : '忽略此遊戲'"
          @click="emit('toggle-ignore', game.id)"
        >
          <EyeSlashIcon :slashed="isIgnored" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Card shell ───────────────────────────────────────────── */
.game-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  transition: transform var(--transition), box-shadow var(--transition);
}

.game-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.game-card--ignored {
  opacity: 0.5;
}

/* ── Cover image ──────────────────────────────────────────── */
.game-card__image {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
}

.game-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.game-card__platform {
  position: absolute;
  top: var(--gap-xs);
  right: var(--gap-xs);
  background: var(--accent);
  color: #fff;
  padding: 2px var(--gap-sm);
  border-radius: var(--radius-pill);
  font-size: var(--fs-sm);
  font-weight: 600;
  line-height: 1.4;
}

/* ── Body (content + actions) ─────────────────────────────── */
.game-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.game-card__content {
  padding: var(--gap-sm);
  flex: 1;
}

.game-card__title {
  margin: 0 0 var(--gap-xs);
  font-size: var(--fs);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Pricing ──────────────────────────────────────────────── */
.game-card__pricing {
  display: flex;
  align-items: baseline;
  gap: var(--gap-xs);
  flex-wrap: wrap;
}

.game-card__discount {
  background: var(--warning);
  color: #fff;
  padding: 2px var(--gap-xs);
  border-radius: var(--radius);
  font-size: var(--fs-sm);
  font-weight: 700;
}

.game-card__current-price {
  font-weight: 700;
  color: var(--accent);
  font-size: var(--fs);
}

.game-card__original-price {
  text-decoration: line-through;
  color: var(--muted);
  font-size: var(--fs-sm);
}

.game-card__no-price {
  color: var(--muted);
  font-style: italic;
  font-size: var(--fs-sm);
}

/* ── Action buttons ───────────────────────────────────────── */
.game-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-sm);
  padding: var(--gap-xs) var(--gap-sm);
  border-top: 1px solid var(--border);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--h);
  height: var(--h);
  padding: 0;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--text);
  transition:
    background var(--transition),
    color var(--transition),
    border-color var(--transition),
    transform var(--transition-fast);
}

.action-btn:hover {
  background: var(--surface-2);
}

.action-btn--active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(230, 0, 18, 0.06);
}

.action-btn:active {
  transform: scale(0.92);
}

.action-btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* ── Mobile compact ≤767 ─────────────────────────────────── */
@media (max-width: 767px) {
  .game-card {
    flex-direction: row;
    border-radius: var(--radius);
  }

  .game-card:hover {
    transform: translateY(-1px);
  }

  .game-card__image {
    width: 80px;
    min-width: 80px;
    height: 107px;
    aspect-ratio: auto;
  }

  .game-card__platform {
    font-size: 0.6rem;
    padding: 1px 4px;
  }

  .game-card__body {
    flex: 1;
    min-width: 0;
  }

  .game-card__content {
    padding: var(--gap-sm);
  }

  .game-card__title {
    font-size: var(--fs);
    -webkit-line-clamp: 1;
    margin-bottom: var(--gap-xs);
  }

  .game-card__pricing {
    flex-wrap: nowrap;
  }

  .game-card__current-price {
    font-size: var(--fs-sm);
  }

  .game-card__original-price {
    font-size: 0.65rem;
  }

  .game-card__actions {
    padding: 0 var(--gap-sm) var(--gap-xs);
    border-top: none;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    font-size: 0.95rem;
  }
}

/* ── Desktop ≥768 (explicit reset) ──────────────────────── */
@media (min-width: 768px) {
  .game-card {
    flex-direction: column;
  }
}
</style>
