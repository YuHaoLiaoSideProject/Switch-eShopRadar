<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
import GamepadIcon from './components/icons/GamepadIcon.vue';
import FireIcon from './components/icons/FireIcon.vue';
import GiftIcon from './components/icons/GiftIcon.vue';
import NewIcon from './components/icons/NewIcon.vue';
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <h1 class="app-title"><GamepadIcon :size="28" /> Switch eShop Radar</h1>
      <nav class="app-nav">
        <RouterLink to="/hot" class="nav-link"><FireIcon /> 熱門</RouterLink>
        <RouterLink to="/deals" class="nav-link"><GiftIcon /> 折扣</RouterLink>
        <RouterLink to="/new" class="nav-link"><NewIcon /> 新發售</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* ── Header (§6.1 RWD behaviour) ──────────────────────────── */
.app-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-sm) var(--gap-lg);
  background: var(--accent);
  color: #fff;
}

.app-title {
  margin: 0;
  font-size: var(--fs-xl);
  white-space: nowrap;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--h);
  padding: 0 var(--gap-md);
  color: #fff;
  font-size: var(--fs);
  border-radius: var(--radius);
  transition: background var(--transition);
  white-space: nowrap;
}

.nav-link:hover,
.nav-link.router-link-active {
  background: rgba(255, 255, 255, 0.2);
}

/* focus-visible for keyboard users */
.nav-link:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ── Main content area ──────────────────────────────────── */
.app-main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--gap-lg);
}

/* ── Tablet (≤1023px) ──────────────────────────────────── */
@media (max-width: 1023px) {
  .app-header {
    padding: var(--gap-sm) var(--gap-md);
  }

  .app-title {
    font-size: var(--fs-lg);
  }

  .app-main {
    padding: var(--gap-md);
  }
}

/* ── Mobile (≤767px) ───────────────────────────────────── */
@media (max-width: 767px) {
  .app-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--gap-sm);
    padding: var(--gap-sm);
  }

  .app-title {
    text-align: center;
    font-size: var(--fs-lg);
  }

  .app-nav {
    justify-content: center;
    flex-wrap: wrap;
  }

  .nav-link {
    height: var(--h-mobile);
    min-width: var(--h-mobile);
    padding: 0 var(--gap-sm);
    font-size: var(--fs-sm);
  }

  .app-main {
    padding: var(--gap-sm);
  }
}
</style>
